import PSD from 'psd';
import sharp from 'sharp';
import cloudinary from '../../api/cloudinary.mjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

// ------------------ Utility ------------------
const uploadDir = path.join(process.cwd(), 'uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

export const templateUpload = multer({
  storage,
  limits: {
    fileSize: 300 * 1024 * 1024, // 300MB
    files: 1
  }
}).single('psd_file');

/**
 * Upload PNG stream (from PSD node.toPng())
 */
export function uploadPngStream(pngStream, publicId) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: 'banner_layers',
        public_id: publicId,
        resource_type: 'image',
        transformation: [
          { quality: 'auto' },
          { fetch_format: 'auto' }
        ]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result.secure_url);
      }
    );

    pngStream.pipe(uploadStream);
  });
}


export async function processPSD(psdPath) {
  console.log("==================================================");
  console.log("🚀 Starting PSD Processing");
  console.log("📂 File:", psdPath);
  console.log("==================================================");

  const startTime = Date.now();
  const psd = PSD.fromFile(psdPath);
  psd.parse();

  const canvas = { width: psd.header.width, height: psd.header.height };

  // Preview & thumbnail
  const previewPng = await psd.image.toPng();
  const thumbnail = await generateThumbnailFromPsdPreview(previewPng);
  console.log("🖼 Canvas Size:", canvas.width, "x", canvas.height);

  const nodes = flatten(psd.tree().children());
  console.log(`📦 Total Visible Layers: ${nodes.length}`);

  const layers = [];

  if (nodes.length === 0) {
    console.log("⚠️ No layers found. Exporting composite image.");
    const layer = {
      id: 0,
      name: 'background',
      type: 'image',
      top: 0,
      left: 0,
      width: canvas.width,
      height: canvas.height,
      opacity: 255,
      zIndex: 0,
      locked: true,
      editable: false,
      replaceable: true,
      src: await uploadPngStream(previewPng.pack(), `background_${Date.now()}`)
    };
    layers.push(layer);
  } else {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      console.log(`🔹 Layer ${i + 1}/${nodes.length}: ${node.name}`);

      const bounds = getLayerBounds(node, canvas);
      const type = detectType(node);

      // Lock detection
      let locked = false;
      try {
        const prot = node.layer?.protected; // bitmask from PSD
        locked = typeof prot === 'number' ? prot !== 0 : Boolean(prot);
      } catch (_) {
        locked = false;
      }

      const layer = {
        id: i,
        name: safeName(node.name),
        type: type === 'shape' ? 'image' : type,
        ...bounds,
        opacity: Math.round((node.export().opacity ?? 1) * 255),
        zIndex: i,
        locked,
        editable: type === 'text' ? !locked : false,
        replaceable: type !== 'text' ? !locked : false,
      };

      if (type === 'text') {
        Object.assign(layer, extractText(node, locked));
      } else {
        try {
          const png = await node.toPng();
          layer.src = await uploadPngStream(
            png.pack(),
            `layer_${Date.now()}_${i}_${safeName(node.name)}`
          );
        } catch (err) {
          console.error("❌ Upload failed:", err.message);
        }
      }

      layers.push(layer);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log("==================================================");
  console.log(`✅ Finished Processing`);
  console.log(`📦 Total Layers Exported: ${layers.length}`);
  console.log(`⏱ Total Time: ${totalTime}s`);
  // logMemory("End");
  console.log("==================================================");
  return { layout: { canvas, layers }, thumbnail }


}

/* ======================================================
   HELPERS
====================================================== */

const safeName = (name = 'layer') =>
  name.replace(/[\/\\:*?"<>|]/g, '').replace(/\s+/g, '_').toLowerCase();

function flatten(nodes, out = []) {
  for (const n of nodes) {
    if (!n || n.hidden?.()) continue;
    if (n.isGroup && n.isGroup()) flatten(n.children() || [], out);
    else if (n.isLayer && n.isLayer()) out.push(n);
  }
  return out.reverse();
}

function getLayerBounds(node, canvas) {
  const e = node.export();
  return {
    top: e.top || 0,
    left: e.left || 0,
    width: e.width || (node.layer?.right - node.layer?.left) || canvas.width,
    height: e.height || (node.layer?.bottom - node.layer?.top) || canvas.height
  };
}

function isShapeLayer(node) {
  const name = (node.name || '').toLowerCase();
  return /(rectangle|ellipse|shape|polygon|line|gradient fill)/.test(name) ||
    node.get('vectorMask') || node.get('vectorStrokeData') || node.get('vectorShapeGraphics');
}

const detectType = node => node.get('typeTool') ? 'text' : isShapeLayer(node) ? 'shape' : 'image';

async function generateThumbnailFromPsdPreview(pngObject) {
  const buffer = await new Promise((resolve, reject) => {
    const chunks = [];
    pngObject.pack()
      .on("data", chunk => chunks.push(chunk))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .on("error", reject);
  });

  const thumbnailBuffer = await sharp(buffer)
    .resize({ width: 400 })
    .jpeg({ quality: 80 })
    .toBuffer();

  console.log(
    "📦 Thumbnail Size:",
    (thumbnailBuffer.length / 1024).toFixed(2),
    "KB"
  );

  // Upload to Cloudinary
  const thumbnailUrl = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "banner_thumbnails"
      },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    );
    uploadStream.end(thumbnailBuffer);
  });
}

// ------------------ Text Extraction ------------------
function extractText(node, locked = false) {
  const tool = node.get('typeTool');
  if (!tool) return {};

  const exported = node.export();
  const font = exported.text?.font || {};
  const rawSize = font.sizes?.[0] || 24;
  const transform = exported.text?.transform || {};
  const scaleX = transform.xx != null ? Math.abs(transform.xx) : 1;
  const fontSize = Math.round(rawSize * scaleX);

  const [r = 0, g = 0, b = 0, a = 255] = font.colors?.[0] || [];
  const color = `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`;

  const alignMap = { left: 'left', right: 'right', center: 'center', justify: 'justify' };
  const textAlign = alignMap[font.alignment?.[0]] || 'left';

  const fontName = font.names?.[0] || 'System';
  const isBold = /bold/i.test(fontName) || !!font.fauxBold;
  const isItalic = /italic|oblique/i.test(fontName) || !!font.fauxItalic;
  const isUnderline = !!font.underline;
  const isStrikethrough = !!font.strikethrough;

  const tracking = font.tracking || 0;
  const letterSpacing = tracking !== 0 ? (tracking / 1000) * fontSize : undefined;

  const leading = font.leading;
  const lineHeight = leading != null ? leading / fontSize : undefined;

  return {
    content: tool.textValue?.replace(/\r/g, '\n') || '',
    editable: !locked,
    style: {
      fontSize,
      fontFamily: fontName,
      textAlign,
      color,
      fontWeight: isBold ? 'bold' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal',
      textDecorationLine: isUnderline ? 'underline' :
        isStrikethrough ? 'line-through' : 'none',
      ...(letterSpacing != null ? { letterSpacing } : {}),
      ...(lineHeight != null ? { lineHeight } : {}),
    }
  };
}