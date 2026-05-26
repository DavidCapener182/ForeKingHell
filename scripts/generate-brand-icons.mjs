import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const outDir = "public/icons";
const sourceLogo = "public/brand/lm-world-tour-logo.png";

mkdirSync(outDir, { recursive: true });

if (!existsSync(sourceLogo)) {
  throw new Error(`Missing brand logo source: ${sourceLogo}`);
}

await renderPng("favicon-16x16.png", 16);
await renderPng("favicon-32x32.png", 32);
await renderPng("apple-touch-icon.png", 180);
await renderPng("lmwt-icon-192.png", 192);
await renderPng("lmwt-icon-512.png", 512);
await renderPng("lmwt-icon-maskable-192.png", 192, { maskable: true });
await renderPng("lmwt-icon-maskable-512.png", 512, { maskable: true });

const faviconPngs = await Promise.all([pngBuffer(16), pngBuffer(32)]);
writeFileSync("src/app/favicon.ico", icoBuffer(faviconPngs));

console.log("Generated LM World Tour brand icons from supplied logo.");

async function renderPng(file, size, options = {}) {
  await sharp(await iconBuffer(size, options))
    .png()
    .toFile(path.join(outDir, file));
}

async function pngBuffer(size, options = {}) {
  return iconBuffer(size, options);
}

async function iconBuffer(size, { maskable = false } = {}) {
  const padding = maskable ? Math.round(size * 0.12) : 0;
  const innerSize = size - padding * 2;
  const logo = await sharp(sourceLogo)
    .resize(innerSize, innerSize, {
      fit: "contain",
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([{ input: logo, top: padding, left: padding }])
    .png()
    .toBuffer();
}

function icoBuffer(images) {
  const headerSize = 6;
  const entrySize = 16;
  const directorySize = headerSize + images.length * entrySize;
  const imageBytes = images.reduce((total, image) => total + image.length, 0);
  const buffer = Buffer.alloc(directorySize + imageBytes);

  buffer.writeUInt16LE(0, 0);
  buffer.writeUInt16LE(1, 2);
  buffer.writeUInt16LE(images.length, 4);

  let imageOffset = directorySize;
  for (const [index, image] of images.entries()) {
    const size = index === 0 ? 16 : 32;
    const entryOffset = headerSize + index * entrySize;
    buffer.writeUInt8(size, entryOffset);
    buffer.writeUInt8(size, entryOffset + 1);
    buffer.writeUInt8(0, entryOffset + 2);
    buffer.writeUInt8(0, entryOffset + 3);
    buffer.writeUInt16LE(1, entryOffset + 4);
    buffer.writeUInt16LE(32, entryOffset + 6);
    buffer.writeUInt32LE(image.length, entryOffset + 8);
    buffer.writeUInt32LE(imageOffset, entryOffset + 12);
    image.copy(buffer, imageOffset);
    imageOffset += image.length;
  }

  return buffer;
}
