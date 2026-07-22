import "server-only";

import sharp, { type Sharp } from "sharp";

const MAX_IMAGE_PIXELS = 40_000_000;

export async function sanitizeScorecardImageDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:image\/(jpeg|png|webp);base64,([a-z0-9+/]+={0,2})$/i);
  if (!match) throw new Error("Unsupported scorecard image data URL.");

  const mime = match[1].toLowerCase() as "jpeg" | "png" | "webp";
  const input = Buffer.from(match[2], "base64");
  const decoder = sharp(input, {
    failOn: "warning",
    limitInputPixels: MAX_IMAGE_PIXELS,
    sequentialRead: true,
  }).rotate();
  const output = await encodeWithoutMetadata(decoder, mime);

  return {
    byteLength: output.byteLength,
    dataUrl: `data:image/${mime};base64,${output.toString("base64")}`,
  };
}

function encodeWithoutMetadata(image: Sharp, mime: "jpeg" | "png" | "webp") {
  if (mime === "jpeg") {
    return image.jpeg({ chromaSubsampling: "4:4:4", quality: 92 }).toBuffer();
  }

  if (mime === "png") {
    return image.png({ compressionLevel: 9 }).toBuffer();
  }

  return image.webp({ quality: 92 }).toBuffer();
}
