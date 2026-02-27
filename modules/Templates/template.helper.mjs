import PSD from 'psd';
import sharp from 'sharp';
import cloudinary from '../../api/cloudinary.mjs';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { uploadFileToS3 } from '../../api/uploads3.mjs';

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
    files: 2
  }
}).single('psd_file');

async function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
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
  const documentDPI = psd.header?.resolution || 72;

  const canvas = {
    width: psd.header.width,
    height: psd.header.height
  };

  const previewPng = await psd.image.toPng();
  const thumbnail = await generateThumbnailFromPsdPreview(previewPng);

  console.log("🖼 Canvas Size:", canvas.width, "x", canvas.height);

  const nodes = flatten(psd.tree().children());
  const layers = [];

  // If no layers, upload composite and return
  if (nodes.length === 0) {
    console.log("⚠️ No layers found. Exporting single composite image.");

    const png = await psd.image.toPng();
    const buffer = await streamToBuffer(png.pack());

    const url = await uploadFileToS3(
      buffer,
      "bannerwala",
      `background_${Date.now()}.png`
    );

    layers.push({
      id: 0,
      name: "background",
      type: "image",
      top: 0,
      left: 0,
      width: canvas.width,
      height: canvas.height,
      opacity: 255,
      zIndex: 0,
      editable: false,
      src: url
    });

    console.log("✅ Uploaded composite:", url);
  } else {
    // Prepare all async layer tasks
    const layerTasks = nodes.map(async (node, i) => {
      console.log(`🔹 Queued Layer ${i + 1}/${nodes.length} for processing → ${node.name}`);

      const bounds = getLayerBounds(node, canvas);
      const type = detectType(node);

      const layer = {
        id: i,
        name: safeName(node.name),
        type: type === "shape" ? "image" : type,
        ...bounds,
        opacity: Math.round((node.export().opacity || 1) * 255),
        zIndex: i,
        editable: type === "text"
      };

      if (type === "text") {
        console.log(`📝 Extracting text for ${node.name}`);
        Object.assign(layer, extractText(node, documentDPI));
        return layer;
      }

      try {
        const png = await node.toPng();
        const buffer = await streamToBuffer(png.pack());

        const uploadStart = Date.now();
        const url = await uploadFileToS3(
          buffer,
          "bannerwala",
          `layer_${Date.now()}_${i}_${safeName(node.name)}.png`
        );

        console.log(`✅ Upload complete for ${node.name} (${((Date.now() - uploadStart) / 1000).toFixed(2)}s)`);

        layer.src = url;
      } catch (err) {
        console.error(`❌ Upload failed for layer ${node.name}:`, err.message);
      }

      return layer;
    });

    // Wait for all layer tasks to complete in parallel
    const results = await Promise.allSettled(layerTasks);

    // Add only fulfilled results
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        layers.push(result.value);
      }
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("==================================================");
  console.log(`✅ Finished Processing`);
  console.log(`📦 Total Layers Exported: ${layers.length}`);
  console.log(`⏱ Total Time: ${totalTime}s`);
  console.log("==================================================");

  return { layout: { canvas, layers }, thumbnail };
}

/* ======================================================
   HELPERS
====================================================== */

const safeName = (name = 'layer') =>
  name.replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .toLowerCase();


/* ===============================================
   Generate Thumbnail from JPG/PNG File
=============================================== */

async function generateThumbnailFromPsdPreview(pngObject) {
  console.log("🖼 Converting PSD preview to buffer...");

  const buffer = await new Promise((resolve, reject) => {
    const chunks = [];

    pngObject.pack()
      .on("data", chunk => chunks.push(chunk))
      .on("end", () => resolve(Buffer.concat(chunks)))
      .on("error", reject);
  });

  console.log(
    "📦 Original Preview Size:",
    (buffer.length / 1024 / 1024).toFixed(2),
    "MB"
  );

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

  const thumbnailUrl = await uploadFileToS3(
    thumbnailBuffer,
    "bannerwala",
    `banner_thumbnails/thumbnailBuffer_${Date.now()}.png`
  );

  return thumbnailUrl;
}

/* ======================================================
   TYPE DETECTION
====================================================== */

function isShapeLayer(node) {
  const name = (node.name || '').toLowerCase();

  return (
    /(rectangle|ellipse|shape|polygon|line|gradient fill)/.test(name) ||
    node.get('vectorMask') ||
    node.get('vectorStrokeData') ||
    node.get('vectorShapeGraphics')
  );
}

function detectType(node) {
  return node.get('typeTool')
    ? 'text'
    : isShapeLayer(node)
      ? 'shape'
      : 'image';
}
/* ======================================================
   BOUNDS
====================================================== */

function getLayerBounds(node, canvas) {
  const e = node.export();

  return {
    top: e.top || 0,
    left: e.left || 0,
    width:
      e.width ||
      node.get('mask')?.width ||
      (node.layer?.right - node.layer?.left) ||
      canvas.width,
    height:
      e.height ||
      node.get('mask')?.height ||
      (node.layer?.bottom - node.layer?.top) ||
      canvas.height
  };
}

/* ======================================================
   TREE FLATTEN
====================================================== */

function flatten(nodes, out = []) {
  for (const n of nodes) {
    if (!n || n.hidden?.()) continue;

    if (n.isGroup && n.isGroup()) {
      flatten(n.children() || [], out);
    } else if (n.isLayer && n.isLayer()) {
      out.push(n);
    }
  }
  return out.reverse();
}

/* ======================================================
   TEXT
====================================================== */

function extractText(node, documentDPI = 72) {

  const tool = node.get('typeTool');
  if (!tool) return null;

  const exported = node.export();
  const font = exported.text?.font || {};

  let rawSize = font.sizes?.[0] || 24;

  let size = documentDPI !== 72
    ? rawSize * (72 / documentDPI)
    : rawSize;

  const transform = exported.text?.transform;

  if (transform && transform.xx && transform.yy) {
    const avgScale = (Math.abs(transform.xx) + Math.abs(transform.yy)) / 2;
    size = size * avgScale;
  }

  const fontName = font.names?.[0] || 'System';
  const weight = extractFontWeight(fontName);

  const [r, g, b, a] = font.colors?.[0] || [0, 0, 0, 255];

  return {
    content: tool.textValue?.replace(/\r/g, '\n') || '',
    style: {
      fontSize: Math.round(size),
      lineHeight: Math.round(size),
      fontFamily: fontName.replace(/-(thin|light|regular|medium|semibold|bold|black)/i, ''),
      fontWeight: weight,
      color: `rgba(${r},${g},${b},${a / 255})`
    }
  };
}

function extractFontWeight(fontName = '') {
  const name = fontName.toLowerCase();

  if (name.includes('thin')) return 100;
  if (name.includes('extralight') || name.includes('ultralight')) return 200;
  if (name.includes('light')) return 300;
  if (name.includes('regular')) return 400;
  if (name.includes('medium')) return 500;
  if (name.includes('semibold') || name.includes('demibold')) return 600;
  if (name.includes('bold')) return 700;
  if (name.includes('extrabold') || name.includes('ultrabold')) return 800;
  if (name.includes('black') || name.includes('heavy')) return 900;

  return 400;
}