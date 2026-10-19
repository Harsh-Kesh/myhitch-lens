import "server-only";

import { writeFile, mkdir } from "fs/promises";
import { createHash } from "crypto";
import path from "path";

import { prisma } from "@/lib/prisma";
import { isSupabaseStorageConfigured, uploadToStorage } from "@/lib/storage";
import { averageHash, hammingDistance, NEAR_DUPLICATE_THRESHOLD } from "@/lib/imageHash";
import { applyWatermark, embedCopyrightMetadata } from "@/lib/copyrightMedia";

/**
 * Storing an uploaded file, as /api/upload does it (and the MYHitch app's
 * avatar upload): copyright fingerprint, near-duplicate check, copyright
 * metadata/watermark on images, then Supabase Storage (or public/uploads in
 * local dev). The caller checks who is uploading, the type and the size.
 */

export const EXT_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/webm": ".weba",
  "audio/mp4": ".m4a",
};

/** The file couldn't be written to storage; the message is safe to show. */
export class StorageUploadError extends Error {}

export type StoredUpload =
  | { url: string; sha256: string; duplicate: true; firstUploadedAt: string; ownUpload: boolean }
  | { url: string; sha256: string; duplicate: false; nearDuplicateOf: string | null };

export async function storeUpload(input: {
  bytes: Buffer;
  type: string;
  uploaderId: string;
  uploaderName: string;
  watermark?: boolean;
}): Promise<StoredUpload> {
  const originalBuffer = input.bytes;
  const sha256 = createHash("sha256").update(originalBuffer).digest("hex");
  const mediaType = input.type.split("/")[0]; // image | video | audio

  // Copyright fingerprint: if this exact file was uploaded before, reuse it and
  // flag the duplicate rather than storing another copy. Exception: a record
  // pointing at the old local-disk fallback (`/uploads/...`) is stale once
  // Supabase Storage is active — that file was wiped by an earlier redeploy —
  // so treat it as missing and re-upload fresh instead of returning a dead link.
  const existing = await prisma.assetFingerprint.findUnique({ where: { sha256 } });
  const existingIsStaleLocalFile =
    existing && isSupabaseStorageConfigured() && existing.url.startsWith("/uploads/");

  if (existing && !existingIsStaleLocalFile) {
    return {
      url: existing.url,
      sha256,
      duplicate: true,
      firstUploadedAt: existing.createdAt.toISOString(),
      ownUpload: existing.uploaderId === input.uploaderId,
    };
  }

  // Near-duplicate check (images only): catches a re-saved/cropped copy that
  // exact hashing would miss. Informational — never blocks the upload.
  let phash: string | null = null;
  let nearDuplicateOf: string | null = null;
  if (mediaType === "image") {
    phash = await averageHash(originalBuffer);
    if (phash) {
      const candidates = await prisma.assetFingerprint.findMany({
        where: { mediaType: "image", phash: { not: null } },
        select: { phash: true, url: true },
        take: 500,
      });
      for (const c of candidates) {
        if (c.phash && hammingDistance(phash, c.phash) <= NEAR_DUPLICATE_THRESHOLD) {
          nearDuplicateOf = c.url;
          break;
        }
      }
    }
  }

  // Protect the file before it's stored: embed copyright metadata (author name,
  // invisible) always, and a visible watermark if the uploader asked for one.
  let outBuffer: Buffer = originalBuffer;
  if (mediaType === "image") {
    outBuffer = await embedCopyrightMetadata(outBuffer, input.type, {
      author: input.uploaderName,
      license: "All rights reserved",
    });
    if (input.watermark) {
      outBuffer = await applyWatermark(outBuffer, input.type, input.uploaderName);
    }
  }

  const ext = EXT_MAP[input.type] || "";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const bytes = new Uint8Array(outBuffer);

  let url: string;
  try {
    if (isSupabaseStorageConfigured()) {
      // Production path: persists across redeploys (the local filesystem doesn't).
      url = await uploadToStorage(`${mediaType}/${filename}`, bytes, input.type);
    } else {
      // Local dev fallback — no Supabase Storage keys needed to run the app locally.
      const uploadDir = path.join(process.cwd(), "public", "uploads");
      await mkdir(uploadDir, { recursive: true });
      await writeFile(path.join(uploadDir, filename), bytes);
      url = `/uploads/${filename}`;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown storage error";
    console.error("Upload storage error:", message);
    throw new StorageUploadError(message);
  }

  if (existingIsStaleLocalFile) {
    // Heal the stale record in place (sha256 is unique — update, don't create).
    await prisma.assetFingerprint.update({
      where: { sha256 },
      data: { url, mediaType, phash, uploaderId: input.uploaderId },
    });
  } else {
    await prisma.assetFingerprint.create({
      data: { sha256, phash, url, mediaType, uploaderId: input.uploaderId },
    });
  }

  return { url, sha256, duplicate: false, nearDuplicateOf };
}
