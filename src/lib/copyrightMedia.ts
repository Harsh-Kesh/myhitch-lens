import "server-only";

import sharp from "sharp";

/**
 * Embed IPTC/EXIF copyright metadata into an uploaded image (author + licence)
 * so ownership travels with the file even if it's downloaded and reused
 * elsewhere. Best-effort: formats sharp can't write EXIF into (SVG, GIF) are
 * returned unchanged. Never throws — a metadata failure shouldn't block an
 * upload.
 */
export async function embedCopyrightMetadata(
  buffer: Buffer,
  mimeType: string,
  info: { author: string; license: string },
): Promise<Buffer> {
  if (mimeType === "image/svg+xml" || mimeType === "image/gif") return buffer;

  try {
    const copyright = `© ${info.author}. ${info.license}.`;
    return await sharp(buffer)
      .withMetadata({
        exif: {
          IFD0: {
            Copyright: copyright,
            Artist: info.author,
          },
        },
      })
      .toBuffer();
  } catch {
    return buffer;
  }
}

/**
 * Stamp a semi-transparent visible watermark (author name) across the bottom
 * of an image. Opt-in — most published article images read better without
 * one, but some authors want the visible deterrent.
 */
export async function applyWatermark(buffer: Buffer, mimeType: string, text: string): Promise<Buffer> {
  if (mimeType === "image/svg+xml" || mimeType === "image/gif") return buffer;

  try {
    const image = sharp(buffer);
    const meta = await image.metadata();
    const width = meta.width ?? 800;
    const height = meta.height ?? 600;
    const fontSize = Math.max(12, Math.round(width / 40));
    const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const svg = `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <text x="${width - 12}" y="${height - 12}" text-anchor="end"
              font-family="sans-serif" font-size="${fontSize}"
              fill="white" fill-opacity="0.55"
              stroke="black" stroke-opacity="0.35" stroke-width="1">
          © ${escaped}
        </text>
      </svg>`;

    return await image.composite([{ input: Buffer.from(svg), gravity: "southeast" }]).toBuffer();
  } catch {
    return buffer;
  }
}
