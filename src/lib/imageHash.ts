import "server-only";

import sharp from "sharp";

/**
 * 64-bit average-hash (aHash) of an image: shrink to 8×8 grayscale, compare
 * each pixel to the mean, one bit per pixel. Cheap and dependency-light, and
 * — unlike a byte-for-byte SHA-256 — survives re-saves, minor recompression,
 * and small crops/edits, so it catches near-duplicate re-uploads that an
 * exact hash misses.
 */
export async function averageHash(buffer: Buffer): Promise<string | null> {
  try {
    const { data } = await sharp(buffer)
      .resize(8, 8, { fit: "fill" })
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const mean = data.reduce((sum, v) => sum + v, 0) / data.length;
    let bits = "";
    for (const v of data) bits += v >= mean ? "1" : "0";

    // Pack the 64-bit string into 16 hex chars.
    let hex = "";
    for (let i = 0; i < 64; i += 4) {
      hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    }
    return hex;
  } catch {
    // Not a raster image sharp can decode (e.g. SVG) — skip perceptual hashing.
    return null;
  }
}

/** Hamming distance between two 16-char hex hashes (0–64; lower = more similar). */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return 64;
  let distance = 0;
  for (let i = 0; i < a.length; i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      distance += x & 1;
      x >>= 1;
    }
  }
  return distance;
}

/** Below this distance (out of 64 bits), two images are treated as near-duplicates. */
export const NEAR_DUPLICATE_THRESHOLD = 8;
