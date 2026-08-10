# Course Twin marketing preview assets

The Course Twin marketing fallback images are generated entirely inside this repository by
`generate-marketing-preview.mjs`.

- No external imagery, texture, font, or runtime resource is used.
- Grass, sand, path, water, foliage, lighting, terrain contours, and shot-planning marks are
  deterministic procedural vector artwork rasterised locally with Sharp.
- The internal SVG source exists only in memory during generation. The public outputs are AVIF and
  WebP raster images; the website does not depend on SVG artwork or a remote asset host.
- The artwork is original project material and does not require third-party attribution.

Regenerate from the repository root with:

```sh
node scripts/course-twin/generate-marketing-preview.mjs
```

Generated files:

- `public/assets/generated/course-twin-premium-desktop.avif`
- `public/assets/generated/course-twin-premium-desktop.webp`
- `public/assets/generated/course-twin-premium-mobile.avif`
- `public/assets/generated/course-twin-premium-mobile.webp`
