import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getEntitlements } from "@/lib/entitlements";
import { StorageUploadError, storeUpload } from "@/lib/mediaUpload";

// SVG deliberately excluded: it can embed <script>, and the local-disk
// fallback below serves uploads same-origin, making it a stored-XSS vector.
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
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

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const wantsWatermark = formData.get("watermark") === "true";

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "File type not allowed. Only images, videos, and audio files are accepted." },
      { status: 400 },
    );
  }

  // Video and audio embedding is part of Lens Creator and above. Images are open to
  // everyone. Staff editing on behalf of the platform are exempt.
  const isMotionOrSound = file.type.startsWith("video/") || file.type.startsWith("audio/");
  const isStaff = session.user.role === "editor" || session.user.role === "admin";
  if (isMotionOrSound && !isStaff && !(await getEntitlements(session.user.id)).videoEmbeds) {
    return NextResponse.json(
      { error: "Video and audio embedding isn't included in your plan. Upgrade to Lens Creator or above to add it." },
      { status: 403 },
    );
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json(
      { error: "File too large. Maximum size is 25 MB." },
      { status: 400 },
    );
  }

  // Fingerprint, copyright metadata/watermark and storage: src/lib/mediaUpload.ts.
  try {
    const stored = await storeUpload({
      bytes: Buffer.from(await file.arrayBuffer()),
      type: file.type,
      uploaderId: session.user.id,
      uploaderName: session.user.name ?? "Author",
      watermark: wantsWatermark,
    });
    return NextResponse.json(stored);
  } catch (err) {
    if (err instanceof StorageUploadError) return NextResponse.json({ error: err.message }, { status: 502 });
    throw err;
  }
}
