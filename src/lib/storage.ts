import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Media storage for user uploads (article images/video/audio).
 *
 * Production target is Supabase Storage — the same project already used for
 * the database, so no extra vendor. When SUPABASE_URL /
 * SUPABASE_SERVICE_ROLE_KEY aren't set (plain local dev), callers should fall
 * back to writing into `public/uploads` instead; see `src/app/api/upload/route.ts`.
 */

// Strip ALL whitespace (not just leading/trailing) — a value copy-pasted from
// a dashboard into an env var UI can pick up an embedded newline/space that
// `.trim()` alone won't catch, and neither a URL nor a service-role key is
// ever legitimately whitespace-containing.
function sanitizeEnvValue(v: string): string {
  return v.replace(/\s+/g, "");
}

const BUCKET = sanitizeEnvValue(process.env.SUPABASE_STORAGE_BUCKET || "media").replace(/\/+$/, "");

let client: SupabaseClient | null = null;

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient(): SupabaseClient {
  if (!client) {
    const rawUrl = process.env.SUPABASE_URL;
    const rawKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!rawUrl || !rawKey) {
      throw new Error("Supabase Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).");
    }
    const url = sanitizeEnvValue(rawUrl).replace(/\/+$/, "");
    const key = sanitizeEnvValue(rawKey);
    // Safe to log: the URL is not a secret. The key itself is never logged —
    // only its length, to confirm it wasn't truncated during copy/paste.
    console.log(`Supabase Storage config → url="${url}" (rawLen=${rawUrl.length}, cleanLen=${url.length}), bucket="${BUCKET}", keyLen=${key.length}`);
    // Service-role key: server-only, bypasses RLS — never expose to the client.
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

/** Upload a file to the storage bucket and return its public URL. */
export async function uploadToStorage(
  path: string,
  bytes: Uint8Array,
  contentType: string,
): Promise<string> {
  const supabase = getClient();
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
