import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { sanitizeScorecardImageDataUrl } from "./image-sanitization";

describe("scorecard image sanitization", () => {
  it.each(["jpeg", "png", "webp"] as const)(
    "decodes and re-encodes %s without embedded metadata",
    async (format) => {
      const source = sharp({
        create: {
          width: 16,
          height: 16,
          channels: 3,
          background: { r: 245, g: 245, b: 245 },
        },
      }).withMetadata({
        exif: {
          IFD0: {
            Artist: "Private golfer",
            ImageDescription: "Location and scorecard metadata",
          },
        },
      });
      const input = await source[format]().toBuffer();
      const sanitized = await sanitizeScorecardImageDataUrl(
        `data:image/${format};base64,${input.toString("base64")}`,
      );
      const output = Buffer.from(sanitized.dataUrl.split(",", 2)[1], "base64");
      const metadata = await sharp(output).metadata();

      expect(sanitized.dataUrl).toMatch(new RegExp(`^data:image/${format};base64,`));
      expect(sanitized.byteLength).toBe(output.byteLength);
      expect(metadata.format).toBe(format);
      expect(metadata.exif).toBeUndefined();
      expect(metadata.xmp).toBeUndefined();
      expect(metadata.iptc).toBeUndefined();
    },
  );

  it("rejects bytes that cannot be decoded as the declared image", async () => {
    await expect(
      sanitizeScorecardImageDataUrl(
        `data:image/jpeg;base64,${Buffer.from("not an image").toString("base64")}`,
      ),
    ).rejects.toThrow();
  });
});
