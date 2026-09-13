import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve("tools/course-twin-blender");
const cache = path.join(root, ".cache");
const headers = { "User-Agent": "ForeKingHellOfflineAssets/1.0 (Poly Haven asset preparation)" };
const digest = (bytes, algorithm = "sha256") => createHash(algorithm).update(bytes).digest("hex");
export function safeRelative(name) {
  if (
    !name ||
    name.includes("\\") ||
    path.isAbsolute(name) ||
    name.split("/").some((p) => p === ".." || p === "")
  )
    throw new Error(`Unsafe asset path: ${name}`);
  return name;
}
async function fetchBytes(url, limit = 128 * 1024 * 1024) {
  const parsed = new URL(url);
  if (
    parsed.protocol !== "https:" ||
    !["api.polyhaven.com", "dl.polyhaven.org"].includes(parsed.hostname)
  )
    throw new Error("Unapproved provider URL");
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(120000),
        redirect: "error",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${url}`);
      if (Number(response.headers.get("content-length")) > limit)
        throw new Error("Asset exceeds limit");
      const chunks = [];
      let length = 0;
      for await (const chunk of response.body) {
        length += chunk.length;
        if (length > limit) throw new Error("Asset exceeds limit");
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (error) {
      if (attempt === 2) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
}
async function json(url) {
  return JSON.parse((await fetchBytes(url, 4 * 1024 * 1024)).toString());
}
async function download(id, name, file) {
  const relative = `${safeRelative(id)}/${safeRelative(name)}`;
  const destination = path.join(cache, relative);
  let bytes = await readFile(destination).catch(() => null);
  if (!bytes || digest(bytes, "md5") !== file.md5) bytes = await fetchBytes(file.url);
  if (bytes.length !== file.size || digest(bytes, "md5") !== file.md5)
    throw new Error(`Integrity failure: ${relative}`);
  if (/\.gltf$/.test(name) && JSON.parse(bytes.toString()).asset?.version !== "2.0")
    throw new Error("Invalid glTF");
  if (/\.jpg$/.test(name) && bytes.readUInt16BE(0) !== 0xffd8) throw new Error("Invalid JPEG");
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
  console.log(`${relative}: ${bytes.length} bytes, verified`);
  return {
    originalFile: `.cache/${relative}`,
    downloadUrl: file.url,
    bytes: bytes.length,
    sha256: digest(bytes),
  };
}
async function main() {
  const assets = [];
  const previous = JSON.parse(
    await readFile(path.join(root, "assets.json"), "utf8").catch(() => '{"assets":[]}'),
  );
  for (const [id, type] of [
    ["tree_small_02", "model"],
    ["shrub_04", "model"],
    ["sand_01", "material"],
    ["kiara_5_noon", "environment"],
  ]) {
    const metadata = await json(`https://api.polyhaven.com/info/${id}`);
    const files = await json(`https://api.polyhaven.com/files/${id}`);
    const selected =
      type === "model"
        ? files.gltf["1k"].gltf
        : type === "environment"
          ? files.hdri["1k"].hdr
          : files.Diffuse["1k"].jpg;
    const name =
      type === "model"
        ? `${id}_1k.gltf`
        : type === "environment"
          ? `${id}_1k.hdr`
          : `${id}_diff_1k.jpg`;
    const downloads = [await download(id, name, selected)];
    if (type === "model") {
      const document = JSON.parse(await readFile(path.join(cache, id, name), "utf8"));
      for (const item of [...(document.images ?? []), ...(document.buffers ?? [])]) {
        if (item.uri && !Object.hasOwn(selected.include ?? {}, safeRelative(item.uri)))
          throw new Error("Untracked glTF dependency");
      }
    }
    for (const [includeName, file] of Object.entries(selected.include ?? {}))
      downloads.push(await download(id, includeName, file));
    assets.push({
      id,
      name: metadata.name,
      creator: metadata.authors,
      provider: "Poly Haven",
      sourcePage: `https://polyhaven.com/a/${id}`,
      licence: "CC0-1.0",
      licenceReference: "https://polyhaven.com/license",
      accessTerms: "https://github.com/Poly-Haven/Public-API/blob/master/ToS.md",
      downloadedAt:
        previous.assets.find((a) => a.id === id)?.downloadedAt ?? new Date().toISOString(),
      type,
      downloads,
      usage:
        type === "model"
          ? "Decorative instanced woodland vegetation; no collision authority"
          : type === "environment"
            ? "Optional daylight environment lighting, no geographic backdrop claim"
            : "Mapped bunker surface colour",
    });
  }
  await writeFile(
    path.join(root, "assets.json"),
    JSON.stringify({ schemaVersion: 1, assets }, null, 2) + "\n",
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
