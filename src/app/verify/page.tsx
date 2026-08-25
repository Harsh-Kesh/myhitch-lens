import Link from "next/link";

import { licenseLabel } from "@/lib/licenses";
import { verifyProvenance } from "@/lib/provenance";
import { prisma } from "@/lib/prisma";

export const metadata = { title: "Verify content credential — MYHitch Lens" };

/** Public page: verify an article's minted content credential (provenance). */
export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  const article = id
    ? await prisma.article.findUnique({
        where: { id },
        select: { title: true, publishedAt: true, author: { select: { displayName: true, isVerified: true } } },
      })
    : null;
  const prov = id ? await verifyProvenance(id) : { exists: false as const };

  return (
    <main className="mx-auto max-w-[640px] px-5 py-12">
      <Link href="/" className="text-[13px] font-semibold text-primary hover:underline">
        ← MYHitch Lens
      </Link>
      <h1 className="mt-4 mb-1 font-heading text-2xl font-bold text-text-main">Content Credential</h1>
      <p className="mb-6 text-[13px] text-text-muted">
        Every article is fingerprinted and signed at publication. This page verifies that a published
        article still matches its original, author-attested credential.
      </p>

      {!article || !prov.exists ? (
        <div className="rounded-xl border border-line bg-bg-secondary p-6 text-[13.5px] text-text-muted">
          No content credential found for this article. It may be unpublished or the link is invalid.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line bg-bg-secondary">
          <div
            className={
              prov.intact
                ? "border-b border-line bg-success/10 px-6 py-4"
                : "border-b border-line bg-warning/10 px-6 py-4"
            }
          >
            <span
              className={
                prov.intact
                  ? "text-[15px] font-bold text-success"
                  : "text-[15px] font-bold text-warning"
              }
            >
              {prov.intact ? "✓ Verified — content is intact" : "⚠ Content changed since publication"}
            </span>
            <p className="mt-1 text-[12px] text-text-muted">
              {prov.intact
                ? "The live article matches the signed credential minted at publication."
                : prov.signatureValid
                  ? "The credential signature is valid, but the article text has been edited since it was minted."
                  : "The credential signature could not be validated."}
            </p>
          </div>
          <dl className="divide-y divide-line text-[13px]">
            <Row label="Article" value={article.title} />
            <Row
              label="Author"
              value={`${prov.author ?? article.author.displayName}${article.author.isVerified ? " ✓ (verified)" : ""}`}
            />
            <Row label="Licence" value={licenseLabel(prov.license ?? "all_rights_reserved")} />
            <Row
              label="Minted"
              value={prov.mintedAt ? new Date(prov.mintedAt).toLocaleString() : "—"}
            />
            <Row label="Signature (SHA-256 · HMAC)" value={prov.signatureValid ? "Valid" : "Invalid"} />
            <Row label="Content hash" value={prov.contentHash ?? "—"} mono />
          </dl>
        </div>
      )}
    </main>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-wrap justify-between gap-2 px-6 py-3">
      <dt className="text-text-muted">{label}</dt>
      <dd className={mono ? "max-w-[60%] truncate font-mono text-[11px] text-text-main" : "font-medium text-text-main"}>
        {value}
      </dd>
    </div>
  );
}
