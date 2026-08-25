import "server-only";

import { createHash, createHmac } from "crypto";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

/** Deterministic content hash covering the title + body. */
function contentHash(title: string, content: string): string {
  return createHash("sha256").update(`${title}\n${content}`).digest("hex");
}

/** HMAC signature over the hash, keyed by the server secret (tamper-evident). */
function sign(hash: string): string {
  const secret = process.env.AUTH_SECRET ?? "insecure-dev-secret";
  return createHmac("sha256", secret).update(hash).digest("hex");
}

interface Manifest {
  version: number;
  algo: string;
  contentHash: string;
  title: string;
  author: string;
  authorId: string;
  license: string;
  mintedAt: string;
  signature: string;
}

/**
 * Mint a content-credential record when an article is published: a signed,
 * timestamped hash of the exact content + author. Any later edit changes the
 * live hash, which the Verify page detects. A lightweight, dependency-free
 * stand-in for C2PA/RFC-3161 (those integrate later with a signing cert + TSA).
 */
export async function mintProvenance(articleId: string): Promise<void> {
  const a = await prisma.article.findUnique({
    where: { id: articleId },
    select: {
      title: true,
      content: true,
      license: true,
      author: { select: { id: true, displayName: true } },
    },
  });
  if (!a) return;

  const hash = contentHash(a.title, a.content);
  const manifest: Manifest = {
    version: 1,
    algo: "SHA-256",
    contentHash: hash,
    title: a.title,
    author: a.author.displayName,
    authorId: a.author.id,
    license: a.license,
    mintedAt: new Date().toISOString(),
    signature: sign(hash),
  };

  const manifestJson = manifest as unknown as Prisma.InputJsonValue;
  await prisma.provenanceRecord.upsert({
    where: { articleId },
    update: { c2paManifest: manifestJson },
    create: { articleId, c2paManifest: manifestJson },
  });
}

export interface ProvenanceView {
  exists: boolean;
  author?: string;
  authorId?: string;
  license?: string;
  mintedAt?: string;
  contentHash?: string;
  /** True when the signature is valid AND the live content still matches. */
  intact?: boolean;
  signatureValid?: boolean;
}

/** Verify an article against its minted content credential. */
export async function verifyProvenance(articleId: string): Promise<ProvenanceView> {
  const [rec, a] = await Promise.all([
    prisma.provenanceRecord.findUnique({ where: { articleId } }),
    prisma.article.findUnique({ where: { id: articleId }, select: { title: true, content: true } }),
  ]);
  if (!rec || !rec.c2paManifest || !a) return { exists: false };

  const m = rec.c2paManifest as unknown as Manifest;
  const signatureValid = sign(m.contentHash) === m.signature;
  const liveHash = contentHash(a.title, a.content);
  return {
    exists: true,
    author: m.author,
    authorId: m.authorId,
    license: m.license,
    mintedAt: m.mintedAt,
    contentHash: m.contentHash,
    signatureValid,
    intact: signatureValid && liveHash === m.contentHash,
  };
}
