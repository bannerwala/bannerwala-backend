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

  // logMemory("Before parsing");

  const psd = PSD.fromFile(psdPath);
  psd.parse();

  // logMemory("After parsing");

  const canvas = {
    width: psd.header.width,
    height: psd.header.height
  };


  //Generate preview of psd
  const previewPng = await psd.image.toPng();

  // const previewUrl = await uploadPngStream(
  //   previewPng.pack(),
  //   `preview_${Date.now()}`
  // );

  const thumbnail = await generateThumbnailFromPsdPreview(previewPng)

  // console.log('previewUrl: ', previewUrl);
  console.log('thumbnail: ', thumbnail);

  console.log("🖼 Canvas Size:", canvas.width, "x", canvas.height);

  const nodes = flatten(psd.tree().children());

  // console.log("📦 Total Visible Layers Found:", nodes);

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
      editable: false
    };

    console.log("⬆ Uploading composite image...");

    const png = await psd.image.toPng();
    layer.src = await uploadFileToS3(
      await streamToBuffer(png.pack()),
      "bannerwala",
      `background_${Date.now()}.png`
    );


    console.log("✅ Composite image uploaded:", layer.src);

    layers.push(layer);
  } else {
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];

      console.log(
        `--------------------------------------------------`
      );
      console.log(
        `🔹 Processing Layer ${i + 1}/${nodes.length} → ${node.name}`
      );



      const bounds = getLayerBounds(node, canvas);
      const type = detectType(node);

      const layer = {
        id: i,
        name: safeName(node.name),
        type: type === 'shape' ? 'image' : type,
        ...bounds,
        opacity: Math.round((node.export().opacity || 1) * 255),
        zIndex: i,
        editable: false
      };

      console.log("📐 Bounds:", bounds);
      console.log("🎨 Type:", type);

      if (type === 'text') {
        console.log("📝 Extracting text layer...");
        Object.assign(layer, extractText(node), { editable: true });
        console.log("✅ Text extracted:", layer.content);
      } else {
        try {
          console.log("⬆ Generating PNG...");
          const png = await node.toPng();

          console.log("⬆ Uploading to Cloudinary...");
          const uploadStart = Date.now();

          layer.src = await uploadFileToS3(
            await streamToBuffer(png.pack()),
            "bannerwala",
            `layer_${Date.now()}_${i}_${safeName(node.name)}.png`
          );



          const uploadTime = ((Date.now() - uploadStart) / 1000).toFixed(2);

          console.log("✅ Uploaded:", layer.src);
          console.log(`⏱ Upload Time: ${uploadTime}s`);
        } catch (err) {
          console.error("❌ Upload failed:", err.message);
        }
      }

      layers.push(layer);

      // logMemory(`After layer ${i + 1}`);
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

const rgba = (c, a = 1) =>
  `rgba(${c?.['Rd  '] || 0},${c?.['Grn '] || 0},${c?.['Bl  '] || 0},${a})`;

const rad = d => (d || 0) * Math.PI / 180;


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
   CLOUDINARY UPLOAD FUNCTION (NEW)
====================================================== */

// function uploadPngStream(pngStream, publicId) {
//   return new Promise((resolve, reject) => {
//     const uploadStream = cloudinary.uploader.upload_stream(
//       {
//         folder: 'banner_layers',
//         public_id: publicId,
//         resource_type: 'image',
//         transformation: [
//           { quality: 'auto' },
//           { fetch_format: 'auto' }
//         ]
//       },
//       (error, result) => {
//         if (error) return reject(error);
//         resolve(result.secure_url);
//       }
//     );

//     pngStream.pipe(uploadStream);
//   });
// }

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

const detectType = node =>
  node.get('typeTool') ? 'text' : isShapeLayer(node) ? 'shape' : 'image';

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

function extractText(node) {
  const tool = node.get('typeTool');
  if (!tool) return null;

  const exported = node.export();
  const font = exported.text?.font || {};

  const size = font.sizes?.[0] || 24;
  const [r, g, b, a] = font.colors?.[0] || [0, 0, 0, 255];

  return {
    content: tool.textValue?.replace(/\r/g, '\n') || '',
    style: {
      fontSize: size,
      fontFamily: font.names?.[0] || 'System',
      textAlign: font.alignment?.[0] || 'left',
      color: `rgba(${r},${g},${b},${a / 255})`
    }
  };
}