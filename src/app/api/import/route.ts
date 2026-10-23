import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { takeAiSlot } from "@/lib/aiClient";
import { isSuspended } from "@/lib/authGuards";
import {
  detectImportKind,
  ImportError,
  importDocument,
  MAX_IMPORT_BYTES,
  unsupportedTypeMessage,
} from "@/lib/documentImport";

// Reading a long PDF with the AI can take a few minutes.
export const maxDuration = 300;

/**
 * Read a document the author wrote elsewhere and return it as HTML for the editor. Nothing is saved to the
 * article here: the editor shows the author a summary first and inserts it only when they confirm.
 */
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.user.role !== "author") {
    return NextResponse.json({ error: "Only authors can import documents." }, { status: 403 });
  }
  if (await isSuspended(session.user.id)) {
    return NextResponse.json({ error: "Your account is suspended following repeated copyright violations. Contact support to appeal." }, { status: 403 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const kind = detectImportKind(file.name);
  if (!kind) return NextResponse.json({ error: unsupportedTypeMessage(file.name) }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "That file is empty." }, { status: 400 });
  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json({ error: `That file is too large. The limit is ${MAX_IMPORT_BYTES / 1024 / 1024} MB.` }, { status: 400 });
  }

  if (kind === "pdf" || kind === "image") {
    const slot = takeAiSlot(session.user.id, "import", { dailyLimit: 20, cooldownMs: 3_000 });
    if (!slot.ok) return NextResponse.json({ error: slot.error }, { status: 429 });
  }

  try {
    const result = await importDocument({
      bytes: Buffer.from(await file.arrayBuffer()),
      kind,
      fileName: file.name,
      uploaderId: session.user.id,
      uploaderName: session.user.name ?? "Author",
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ImportError) return NextResponse.json({ error: err.message }, { status: 422 });
    console.error("[api/import]", err);
    return NextResponse.json({ error: "The document couldn't be imported. Please try again." }, { status: 500 });
  }
}
