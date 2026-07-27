import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const SLUG_OVERRIDES = new Map([
  ["4de11156-16fd-4a36-84e0-fadda53456b0", "aintree-v1"],
  ["65359509-5de2-485e-8f85-392bba752710", "arrowe-park-v1"],
]);

export function packageSlugForCourse(course) {
  const override = SLUG_OVERRIDES.get(course.courseId);
  if (override) return override;
  const base = course.name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  if (!base) throw new Error(`Course ${course.courseId} does not have a usable package slug.`);
  return `${base}-v1`;
}

export function localManifestFromCompletion(completion, slug) {
  return {
    ...completion.manifest,
    terrain: {
      ...completion.manifest.terrain,
      heightmap: completion.manifest.terrain.heightmap
        ? {
            ...completion.manifest.terrain.heightmap,
            url: `/course-twins/${slug}/terrain.f32`,
          }
        : null,
      imagery: completion.manifest.terrain.imagery
        ? {
            ...completion.manifest.terrain.imagery,
            url: `/course-twins/${slug}/imagery.jpg`,
          }
        : null,
    },
  };
}

export async function writeLocalCourseTwinPackage({ completion, slug, rootDirectory }) {
  const publicDirectory = resolve(rootDirectory, "public/course-twins", slug);
  const generatedDirectory = resolve(rootDirectory, "src/generated/course-twins");
  await mkdir(publicDirectory, { recursive: true });
  await mkdir(generatedDirectory, { recursive: true });

  const assets = [];
  for (const asset of completion.assets) {
    const bytes = Buffer.from(asset.dataBase64, "base64");
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (digest !== asset.sha256) {
      throw new Error(`${completion.manifest.course.name} ${asset.fileName} failed SHA-256.`);
    }
    const assetPath = resolve(publicDirectory, asset.fileName);
    await writeFile(assetPath, bytes);
    assets.push({
      fileName: asset.fileName,
      byteLength: bytes.byteLength,
      sha256: digest,
      contentType: asset.contentType,
    });
  }

  const manifest = localManifestFromCompletion(completion, slug);
  const manifestPath = resolve(generatedDirectory, `${slug}.json`);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const writtenManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (writtenManifest.course.id !== completion.manifest.course.id) {
    throw new Error(`${completion.manifest.course.name} manifest readback failed.`);
  }

  return { manifest, manifestPath, publicDirectory, assets };
}

export async function readLocalCourseTwinPackage({ courseId, slug, rootDirectory }) {
  const manifestPath = resolve(rootDirectory, "src/generated/course-twins", `${slug}.json`);
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") return null;
    throw error;
  }
  if (manifest.course?.id !== courseId) {
    throw new Error(`${slug} belongs to ${manifest.course?.id ?? "an unknown course"}.`);
  }

  const publicDirectory = resolve(rootDirectory, "public/course-twins", slug);
  const assets = [];
  for (const [assetKey, expectedFileName, contentType] of [
    ["heightmap", "terrain.f32", "application/octet-stream"],
    ["imagery", "imagery.jpg", "image/jpeg"],
  ]) {
    const descriptor = manifest.terrain?.[assetKey];
    if (!descriptor) continue;
    const expectedUrl = `/course-twins/${slug}/${expectedFileName}`;
    if (descriptor.url !== expectedUrl) {
      throw new Error(`${manifest.course.name} ${assetKey} URL is not package-local.`);
    }
    const assetPath = resolve(publicDirectory, expectedFileName);
    const bytes = await readFile(assetPath);
    const digest = createHash("sha256").update(bytes).digest("hex");
    if (descriptor.sha256 && digest !== descriptor.sha256) {
      throw new Error(`${manifest.course.name} ${expectedFileName} failed SHA-256 readback.`);
    }
    assets.push({
      fileName: expectedFileName,
      byteLength: bytes.byteLength,
      sha256: digest,
      contentType,
    });
  }
  if (assets.length === 0) throw new Error(`${manifest.course.name} has no local package assets.`);

  return { manifest, manifestPath, publicDirectory, assets };
}
