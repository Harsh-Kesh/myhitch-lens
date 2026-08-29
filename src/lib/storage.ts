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

const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "media";

let client: SupabaseClient | null = null;

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function getClient(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Supabase Storage is not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing).");
    }
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
