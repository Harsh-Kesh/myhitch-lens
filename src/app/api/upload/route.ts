import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { createHash } from "crypto";
import path from "path";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isSupabaseStorageConfigured, uploadToStorage } from "@/lib/storage";

const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "video/mp4",
  "video/webm",
  "video/ogg",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  "audio/mp4",
]);

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

const EXT_MAP: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
  "image/svg+xml": ".svg",
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/ogg": ".ogv",
  "audio/mpeg": ".mp3",
  "audio/ogg": ".ogg",
  "audio/wav": ".wav",
  "audio/webm": ".weba",
  "audio/mp4": ".m4a",
};

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed. Only images, videos, and audio files are accepted." },
      { status: 400 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 25 MB." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash("sha256").update(buffer).digest("hex");
  const mediaType = file.type.split("/")[0]; // image | video | audio

  // Copyright fingerprint: if this exact file was uploaded before, reuse it and
  // flag the duplicate rather than storing another copy. Exception: a record
  // pointing at the old local-disk fallback (`/uploads/...`) is stale once
  // Supabase Storage is active — that file was wiped by an earlier redeploy —
  // so treat it as missing and re-upload fresh instead of returning a dead link.
  const existing = await prisma.assetFingerprint.findUnique({ where: { sha256 } });
  const existingIsStaleLocalFile =
    existing && isSupabaseStorageConfigured() && existing.url.startsWith("/uploads/");

  if (existing && !existingIsStaleLocalFile) {
    return NextResponse.json({
      url: existing.url,
      sha256,
      duplicate: true,
      firstUploadedAt: existing.createdAt.toISOString(),
      ownUpload: existing.uploaderId === session.user.id,
    });
  }

  const ext = EXT_MAP[file.type] || "";
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const bytes = new Uint8Array(buffer);

  let url: string;
  try {
    if (isSupabaseStorageConfigured()) {
      // Production path: persists across redeploys (the local filesystem doesn't).
      url = await uploadToStorage(`${mediaType}/${filename}`, bytes, file.type);
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
    return NextResponse.json({ error: message }, { status: 502 });
  }

  if (existingIsStaleLocalFile) {
    // Heal the stale record in place (sha256 is unique — update, don't create).
    await prisma.assetFingerprint.update({
      where: { sha256 },
      data: { url, mediaType, uploaderId: session.user.id },
    });
  } else {
    await prisma.assetFingerprint.create({
      data: { sha256, url, mediaType, uploaderId: session.user.id },
    });
  }

  return NextResponse.json({ url, sha256, duplicate: false });
}
