import { readFile, writeFile, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import sharp from "sharp";
const root = "public/course-twins/common/blender-v1";
const report = JSON.parse(await readFile(`${root}/exports.json`, "utf8"));
for (const entry of report.exports) {
  const file = await readFile(`${root}/${entry.file}`);
  const length = file.readUInt32LE(12);
  const gltf = JSON.parse(file.subarray(20, 20 + length).toString());
  const binary = file.subarray(28 + length);
  const chunks = [];
  let offset = 0;
  for (let i = 0; i < gltf.bufferViews.length; i++) {
    const view = gltf.bufferViews[i];
    let bytes = binary.subarray(view.byteOffset ?? 0, (view.byteOffset ?? 0) + view.byteLength);
    const image = gltf.images?.find((image) => image.bufferView === i);
    if (image) {
      const input = sharp(bytes).resize({
        width: 512,
        height: 512,
        fit: "inside",
        withoutEnlargement: true,
      });
      const alpha = (await sharp(bytes).metadata()).hasAlpha;
      bytes = await (
        alpha ? input.png({ compressionLevel: 9 }) : input.jpeg({ quality: 78 })
      ).toBuffer();
      image.mimeType = alpha ? "image/png" : "image/jpeg";
    }
    view.byteOffset = offset;
    view.byteLength = bytes.length;
    chunks.push(bytes);
    offset += bytes.length;
    const padding = (4 - (offset % 4)) % 4;
    chunks.push(Buffer.alloc(padding));
    offset += padding;
  }
  gltf.buffers[0].byteLength = offset;
  const jsonText = JSON.stringify(gltf);
  const json = Buffer.from(jsonText + " ".repeat((4 - (Buffer.byteLength(jsonText) % 4)) % 4));
  const header = Buffer.alloc(20);
  header.write("glTF");
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(28 + json.length + offset, 8);
  header.writeUInt32LE(json.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(offset);
  binHeader.writeUInt32LE(0x004e4942, 4);
  const output = Buffer.concat([header, json, binHeader, ...chunks]);
  await writeFile(`${root}/${entry.file}`, output);
  entry.bytes = output.length;
  entry.sha256 = createHash("sha256").update(output).digest("hex");
}
const sand = await sharp(`${root}/sand-colour.png`).webp({ quality: 82 }).toBuffer();
await writeFile(`${root}/sand-colour.webp`, sand);
await unlink(`${root}/sand-colour.png`);
report.material = {
  file: "sand-colour.webp",
  bytes: sand.length,
  sha256: createHash("sha256").update(sand).digest("hex"),
};
await writeFile(`${root}/exports.json`, JSON.stringify(report, null, 2) + "\n");
const env = await readFile(`${root}/daylight.hdr`);
report.environment = {
  file: "daylight.hdr",
  bytes: env.length,
  sha256: createHash("sha256").update(env).digest("hex"),
};
await writeFile(`${root}/exports.json`, JSON.stringify(report, null, 2) + "\n");
const manifest = JSON.parse(await readFile("tools/course-twin-blender/assets.json", "utf8"));
for (const asset of manifest.assets)
  asset.outputs =
    asset.type === "model"
      ? report.exports
          .filter((e) => e.asset === asset.id)
          .map((e) => ({ ...e, file: `${root}/${e.file}` }))
      : asset.type === "environment"
        ? [{ ...report.environment, file: `${root}/${report.environment.file}` }]
        : [{ ...report.material, file: `${root}/${report.material.file}` }];
await writeFile("tools/course-twin-blender/assets.json", JSON.stringify(manifest, null, 2) + "\n");
console.log(JSON.stringify(report, null, 2));
