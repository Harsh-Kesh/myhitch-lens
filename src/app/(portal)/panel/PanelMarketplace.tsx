"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { formControl, formLabel } from "@/components/ui/Form";
import { dashCard, dashHeading, StatChip } from "@/components/ui/DashboardKit";
import { BarChartIcon, BookIcon, DollarSignIcon, ShoppingCartIcon } from "@/components/ui/icons";
import { VerifiedBadge } from "@/components/ui/VerifiedBadge";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";
import type { AuthorListing, OwnedArticle, PanelListing } from "@/lib/marketplace";

import { acceptBid, buyFixedPrice, createListing, placeBid } from "./actions";

function formatAUD(n: number): string {
  return `A$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

type Tab = "market" | "mine" | "owned";

export function PanelMarketplace({
  open,
  mine,
  listable,
  owned,
  categories,
}: {
  open: PanelListing[];
  mine: AuthorListing[];
  listable: { id: string; title: string; category: string }[];
  owned: OwnedArticle[];
  categories: string[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("market");
  const [isPending, startTransition] = useTransition();
  // Capture "now" once on mount so the countdown is computed from a stable
  // value (avoids calling Date.now() during render).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);
  const mounted = now !== null;

  const [bidOn, setBidOn] = useState<PanelListing | null>(null);
  const [buyOn, setBuyOn] = useState<PanelListing | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const timeLeft = (iso: string) => {
    if (now === null) return "";
    const ms = new Date(iso).getTime() - now;
    if (ms <= 0) return "Ended";
    const days = Math.floor(ms / 86400000);
    const hours = Math.floor((ms % 86400000) / 3600000);
    if (days > 0) return `${days}d ${hours}h left`;
    const mins = Math.floor((ms % 3600000) / 60000);
    return `${hours}h ${mins}m left`;
  };

  function refresh() {
    router.refresh();
  }

  const totalOffers = mine.reduce((s, m) => s + m.bidCount, 0);

  return (
    <>
      <ViewHeader
        title="Ownership Marketplace"
        subtitle="Members acquire commercial ownership of an article — by auction or fixed price. The author always keeps their verified byline; ownership and branding transfer to the buyer."
        actions={
          listable.length > 0 || mine.length > 0 ? (
            <Button size="sm" onClick={() => setShowCreate(true)} disabled={listable.length === 0}>
              Sell an Article
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4 max-[560px]:grid-cols-1">
        <StatChip icon={<ShoppingCartIcon className="size-4" />} value={open.length} label="For sale" />
        <StatChip icon={<BarChartIcon className="size-4" />} value={totalOffers} label="Offers on my articles" />
        <StatChip icon={<BookIcon className="size-4" />} value={owned.length} label="Articles I own" accent />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-line">
        {([["market", "Marketplace"], ["mine", "My Listings"], ["owned", "Articles I Own"]] as const).map(
          ([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={cn(
                "cursor-pointer border-b-2 px-4 py-2 text-sm font-semibold transition-colors",
                tab === key
                  ? "border-primary text-primary"
                  : "border-transparent text-text-muted hover:text-text-main",
              )}
            >
              {label}
              {key === "mine" && mine.length > 0 && (
                <span className="ml-2 rounded-full bg-primary-glow px-2 py-0.5 text-[11px] font-bold text-primary">
                  {mine.length}
                </span>
              )}
              {key === "owned" && owned.length > 0 && (
                <span className="ml-2 rounded-full bg-primary-glow px-2 py-0.5 text-[11px] font-bold text-primary">
                  {owned.length}
                </span>
              )}
            </button>
          ),
        )}
      </div>

      {/* Marketplace tab */}
      {tab === "market" && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-4">
          {open.length === 0 ? (
            <div className={cn(dashCard, "col-[1/-1]")}>
              <p className="p-8 text-center text-[13px] text-text-muted">
                No articles are for sale right now. Check back soon.
              </p>
            </div>
          ) : (
            open.map((l) => (
              <div key={l.auctionId} className="flex flex-col rounded-xl border border-line bg-bg-secondary p-5">
                <div className="mb-2 flex items-center justify-between text-[11px] text-text-muted">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-primary-glow px-2 py-0.5 font-bold text-primary uppercase">{l.category}</span>
                    {l.saleType === "fixed" && (
                      <span className="rounded bg-success/10 px-2 py-0.5 font-bold text-success uppercase">Fixed Price</span>
                    )}
                  </div>
                  <span>{timeLeft(l.endsAt)}</span>
                </div>
                <Link href={`/article?id=${l.articleId}`} className="mb-1 font-heading text-[15px] font-bold text-text-main hover:text-primary">
                  {l.title}
                </Link>
                <p className="mb-3 line-clamp-2 flex-1 text-[12.5px] text-text-muted">{l.summary}</p>
                <div className="mb-3 flex items-center gap-1 text-[11.5px] text-text-muted">
                  Written by {l.author}
                  {l.authorVerified && <VerifiedBadge size="xs" />}
                </div>

                <div className="mb-3 flex items-center justify-between rounded-lg border border-line bg-bg-primary px-3 py-2">
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">
                      {l.saleType === "fixed" ? "Buy Now price" : l.topBid > 0 ? "Top offer" : "Floor price"}
                    </div>
                    <div className="font-heading text-base font-bold text-text-main">
                      {formatAUD(l.saleType === "fixed" ? l.floorPrice : l.topBid > 0 ? l.topBid : l.floorPrice)}
                    </div>
                  </div>
                  {l.saleType === "auction" && (
                    <div className="text-right">
                      <div className="text-[10px] text-text-muted uppercase">Offers</div>
                      <div className="font-semibold text-text-main">{l.bidCount}</div>
                    </div>
                  )}
                </div>

                {l.myBid != null && (
                  <p className="mb-2 text-[11px] font-semibold text-success">Your offer: {formatAUD(l.myBid)}</p>
                )}

                {l.isOwn ? (
                  <p className="rounded-lg bg-bg-tertiary px-3 py-2 text-center text-[11.5px] text-text-muted">
                    Your article — manage {l.saleType === "fixed" ? "this sale" : "offers"} under “My Listings”.
                  </p>
                ) : l.saleType === "fixed" ? (
                  <Button size="sm" className="w-full" onClick={() => setBuyOn(l)}>
                    Buy Now — {formatAUD(l.floorPrice)}
                  </Button>
                ) : (
                  <Button size="sm" className="w-full" onClick={() => setBidOn(l)}>
                    {l.myBid != null ? "Raise Offer" : "Make an Offer"}
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* My listings tab */}
      {tab === "mine" && (
        <div className="flex flex-col gap-4">
          {mine.length === 0 ? (
            <div className={dashCard}>
              <p className="p-8 text-center text-[13px] text-text-muted">
                You haven’t listed any articles for sale yet.
                {listable.length > 0 && " Click “Sell an Article” to open your first listing."}
              </p>
            </div>
          ) : (
            mine.map((m) => (
              <div key={m.auctionId} className={dashCard}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/article?id=${m.articleId}`} className="font-heading text-[15px] font-bold text-text-main hover:text-primary">
                        {m.title}
                      </Link>
                      {m.saleType === "fixed" && (
                        <span className="rounded bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success uppercase">Fixed Price</span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11.5px] text-text-muted">
                      {m.saleType === "fixed" ? "Price" : "Floor"} {formatAUD(m.floorPrice)}
                      {m.saleType === "auction" && m.reservePrice != null && ` · Reserve ${formatAUD(m.reservePrice)}`}
                      {" · "}
                      {mounted ? timeLeft(m.endsAt) : ""}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-bold",
                      m.status === "open" && "bg-primary-glow text-primary",
                      m.status === "closed" && "bg-warning/10 text-warning",
                      m.status === "settled" && "bg-success/10 text-success",
                      m.status === "canceled" && "bg-danger/10 text-danger",
                    )}
                  >
                    {m.status === "settled"
                      ? "Sold"
                      : m.status === "closed"
                        ? "Ended — review offers"
                        : m.status === "canceled"
                          ? "Ended — no offers"
                          : m.status}
                  </span>
                </div>

                {/* Sale (settled) */}
                {m.sale && (
                  <div className="mb-3 rounded-lg border border-success/30 bg-success/5 p-3 text-[12.5px]">
                    <span className="font-semibold text-success">
                      Sold to {m.sale.brandName}
                      {m.sale.amount != null && ` for ${formatAUD(m.sale.amount)}`}
                    </span>
                    {m.sale.changeRequest && (
                      <div className="mt-1 text-text-muted">
                        Agreed change request: “{m.sale.changeRequest}”
                      </div>
                    )}
                    <div className="mt-1 text-[11px] text-text-muted">You keep your verified author credit.</div>
                  </div>
                )}

                {/* Offers (auction only — fixed-price sales settle instantly, no offer list) */}
                {m.saleType === "auction" &&
                  (m.bids.length === 0 ? (
                    <p className="rounded-lg bg-bg-tertiary px-3 py-3 text-center text-[12px] text-text-muted">
                      No offers yet.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {m.bids.map((b) => (
                        <div key={b.bidId} className="rounded-lg border border-line px-3 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <span className="text-[13px] font-semibold text-text-main">{b.brandName}</span>
                              <span className="ml-2 text-[13px] text-text-main">{formatAUD(b.amount)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                                  b.status === "active" && "bg-primary-glow text-primary",
                                  b.status === "won" && "bg-success/10 text-success",
                                  (b.status === "outbid" || b.status === "lost") && "bg-bg-tertiary text-text-muted",
                                )}
                              >
                                {b.status}
                              </span>
                              {(m.status === "open" || m.status === "closed") &&
                                (b.status === "active" || b.status === "outbid") && (
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={isPending}
                                  onClick={() => {
                                    const terms = [
                                      b.removeMedia ? "Remove your media (images/video/audio)" : null,
                                      b.changeRequest ? `"${b.changeRequest}"` : null,
                                    ].filter(Boolean).join("; ");
                                    const msg = terms
                                      ? `Accept ${b.brandName}'s offer of ${formatAUD(b.amount)}?\n\nAgreed terms: ${terms}\n\nAccepting transfers ownership and applies these terms. You keep your verified author credit.`
                                      : `Accept ${b.brandName}'s offer of ${formatAUD(b.amount)}? This transfers ownership. You keep your verified author credit.`;
                                    if (!window.confirm(msg)) return;
                                    startTransition(async () => {
                                      const res = await acceptBid({ bidId: b.bidId });
                                      if ("error" in res) alert(res.error);
                                      else refresh();
                                    });
                                  }}
                                >
                                  Accept
                                </Button>
                              )}
                            </div>
                          </div>
                          {b.removeMedia && (
                            <p className="mt-1.5 rounded bg-warning/10 px-2 py-1 text-[11.5px] text-warning">
                              <span className="font-semibold">Requests media removal</span> — your images/video/audio
                              will be stripped on acceptance (body text kept).
                            </p>
                          )}
                          {b.changeRequest && (
                            <p className="mt-1.5 rounded bg-bg-tertiary px-2 py-1 text-[11.5px] text-text-muted">
                              <span className="font-semibold">Change request:</span> {b.changeRequest}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                {m.saleType === "fixed" && !m.sale && m.status === "open" && (
                  <p className="rounded-lg bg-bg-tertiary px-3 py-3 text-center text-[12px] text-text-muted">
                    Waiting for a buyer — no action needed. Purchases complete instantly.
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Articles I own tab */}
      {tab === "owned" && (
        <div className="flex flex-col gap-4">
          {owned.length === 0 ? (
            <div className={dashCard}>
              <p className="p-8 text-center text-[13px] text-text-muted">
                You don’t own any articles yet. Win an offer or buy one in the Marketplace to acquire it.
              </p>
            </div>
          ) : (
            owned.map((o) => (
              <div key={o.articleId} className={dashCard}>
                <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                  <Link href={`/article?id=${o.articleId}`} className="font-heading text-[15px] font-bold text-text-main hover:text-primary">
                    {o.title}
                  </Link>
                  {o.price != null && (
                    <span className="rounded-full bg-success/10 px-2.5 py-1 text-[11px] font-bold text-success">
                      Acquired for {formatAUD(o.price)}
                    </span>
                  )}
                </div>
                <div className="mb-3 text-[11.5px] text-text-muted">
                  {o.category} · Written by {o.author} (Verified credit retained)
                </div>
                <div className="rounded-lg border border-line bg-bg-primary p-3 text-[12.5px]">
                  <div className="mb-1 font-semibold text-text-main">Your branding is live on this article.</div>
                  {o.changeRequest ? (
                    <div className="text-text-muted">
                      Agreed change request: “{o.changeRequest}” — the author will apply changes touching their
                      original work; you can add your own branding freely.
                    </div>
                  ) : (
                    <div className="text-text-muted">
                      You can add your own branding freely. The author’s verified text and byline remain locked.
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Offer modal (auction) */}
      {bidOn && (
        <BidModal
          listing={bidOn}
          categories={categories}
          pending={isPending}
          onClose={() => setBidOn(null)}
          onSubmit={(data) => {
            startTransition(async () => {
              const res = await placeBid({ auctionId: bidOn.auctionId, ...data });
              if ("error" in res) alert(res.error);
              else {
                setBidOn(null);
                refresh();
              }
            });
          }}
        />
      )}

      {/* Buy Now modal (fixed price) */}
      {buyOn && (
        <BuyNowModal
          listing={buyOn}
          categories={categories}
          pending={isPending}
          onClose={() => setBuyOn(null)}
          onSubmit={(data) => {
            if (!window.confirm(`Buy "${buyOn.title}" now for ${formatAUD(buyOn.floorPrice)}? This completes immediately.`)) return;
            startTransition(async () => {
              const res = await buyFixedPrice({ auctionId: buyOn.auctionId, ...data });
              if ("error" in res) alert(res.error);
              else {
                setBuyOn(null);
                refresh();
              }
            });
          }}
        />
      )}

      {/* Sell listing modal */}
      {showCreate && (
        <CreateListingModal
          listable={listable}
          categories={categories}
          pending={isPending}
          onClose={() => setShowCreate(false)}
          onSubmit={(data) => {
            startTransition(async () => {
              const res = await createListing(data);
              if ("error" in res) alert(res.error);
              else {
                setShowCreate(false);
                setTab("mine");
                refresh();
              }
            });
          }}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 z-50 max-h-[90vh] w-[min(460px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-bg-secondary p-6 shadow-card">
        {children}
      </div>
    </>
  );
}

function BidModal({
  listing,
  categories,
  pending,
  onClose,
  onSubmit,
}: {
  listing: PanelListing;
  categories: string[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (data: {
    amount: number;
    brandCategory: string;
    brandName: string;
    changeRequest: string;
    removeMedia: boolean;
    autoBidCeiling: number | null;
  }) => void;
}) {
  const options = listing.allowedCategories.length > 0 ? listing.allowedCategories : categories;
  const [amount, setAmount] = useState(String(listing.minNextBid));
  const [brandName, setBrandName] = useState("");
  const [brandCategory, setBrandCategory] = useState(options[0] ?? "");
  const [changeRequest, setChangeRequest] = useState("");
  const [removeMedia, setRemoveMedia] = useState(false);
  const [ceiling, setCeiling] = useState("");

  return (
    <ModalShell onClose={onClose}>
      <h3 className="mb-1 font-heading text-lg font-bold text-text-main">Offer to Acquire Ownership</h3>
      <p className="mb-4 text-[12.5px] text-text-muted">
        “{listing.title}”. Minimum offer {formatAUD(listing.minNextBid)}. Your offer stands until the author accepts
        — on acceptance you own the article (the author keeps their verified byline) and pay exactly what you offered.
      </p>

      <div className="mb-4">
        <label className={formLabel}>Offer amount (AUD)</label>
        <input type="number" min={listing.minNextBid} step="1" className={formControl} value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>

      <div className="mb-4">
        <label className={formLabel}>Brand / company name</label>
        <input type="text" className={formControl} placeholder="Shown as the new owner (defaults to your name)" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
      </div>

      <div className="mb-4">
        <label className={formLabel}>Your brand category (brand-safety)</label>
        <select className={formControl} value={brandCategory} onChange={(e) => setBrandCategory(e.target.value)}>
          {options.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {listing.allowedCategories.length > 0 && (
          <p className="mt-1 text-[11px] text-text-muted">
            This author only accepts buyers in: {listing.allowedCategories.join(", ")}.
          </p>
        )}
      </div>

      <div className="mb-4">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={removeMedia}
            onChange={(e) => setRemoveMedia(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span className="text-[12.5px] text-text-main">
            Remove the author’s media on transfer
            <span className="block text-[11px] text-text-muted">
              Automatically strips the author’s images, video &amp; audio when you win — applied on acceptance. The body text stays intact.
            </span>
          </span>
        </label>
      </div>

      <div className="mb-4">
        <label className={formLabel}>Change request (optional)</label>
        <textarea
          rows={3}
          className={formControl}
          placeholder="e.g. Any other edits you'd want — we'll add our product shots and logo."
          value={changeRequest}
          onChange={(e) => setChangeRequest(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-text-muted">
          Anything touching the author’s original work is a term of the sale — the author agrees to it by accepting.
          The article body text and verified byline always stay intact.
        </p>
      </div>

      <div className="mb-5">
        <label className={formLabel}>Auto-bid ceiling (optional)</label>
        <input type="number" step="1" className={formControl} placeholder="Max you'd auto-offer to" value={ceiling} onChange={(e) => setCeiling(e.target.value)} />
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button
          className="flex-1"
          disabled={pending}
          onClick={() =>
            onSubmit({
              amount: Number(amount),
              brandCategory,
              brandName: brandName.trim(),
              changeRequest: changeRequest.trim(),
              removeMedia,
              autoBidCeiling: ceiling.trim() ? Number(ceiling) : null,
            })
          }
        >
          {pending ? "Submitting..." : "Submit Offer"}
        </Button>
      </div>
    </ModalShell>
  );
}

function BuyNowModal({
  listing,
  categories,
  pending,
  onClose,
  onSubmit,
}: {
  listing: PanelListing;
  categories: string[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (data: {
    brandCategory: string;
    brandName: string;
    changeRequest: string;
    removeMedia: boolean;
  }) => void;
}) {
  const options = listing.allowedCategories.length > 0 ? listing.allowedCategories : categories;
  const [brandName, setBrandName] = useState("");
  const [brandCategory, setBrandCategory] = useState(options[0] ?? "");
  const [changeRequest, setChangeRequest] = useState("");
  const [removeMedia, setRemoveMedia] = useState(false);

  return (
    <ModalShell onClose={onClose}>
      <h3 className="mb-1 font-heading text-lg font-bold text-text-main">Buy Now</h3>
      <p className="mb-4 text-[12.5px] text-text-muted">
        “{listing.title}” — fixed price {formatAUD(listing.floorPrice)}. This completes immediately: no waiting for
        author approval. The author keeps their verified byline.
      </p>

      <div className="mb-4 rounded-lg border border-line bg-bg-primary p-3 text-center">
        <div className="text-[10px] text-text-muted uppercase">Price</div>
        <div className="font-heading text-2xl font-bold text-text-main">{formatAUD(listing.floorPrice)}</div>
      </div>

      <div className="mb-4">
        <label className={formLabel}>Brand / company name</label>
        <input type="text" className={formControl} placeholder="Shown as the new owner (defaults to your name)" value={brandName} onChange={(e) => setBrandName(e.target.value)} />
      </div>

      <div className="mb-4">
        <label className={formLabel}>Your brand category (brand-safety)</label>
        <select className={formControl} value={brandCategory} onChange={(e) => setBrandCategory(e.target.value)}>
          {options.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {listing.allowedCategories.length > 0 && (
          <p className="mt-1 text-[11px] text-text-muted">
            This author only accepts buyers in: {listing.allowedCategories.join(", ")}.
          </p>
        )}
      </div>

      <div className="mb-4">
        <label className="flex cursor-pointer items-start gap-2">
          <input
            type="checkbox"
            checked={removeMedia}
            onChange={(e) => setRemoveMedia(e.target.checked)}
            className="mt-0.5 size-4 accent-primary"
          />
          <span className="text-[12.5px] text-text-main">
            Remove the author’s media on transfer
            <span className="block text-[11px] text-text-muted">
              Automatically strips the author’s images, video &amp; audio the moment your purchase completes. The
              body text stays intact.
            </span>
          </span>
        </label>
      </div>

      <div className="mb-5">
        <label className={formLabel}>Change request (optional)</label>
        <textarea
          rows={3}
          className={formControl}
          placeholder="e.g. Any other edits you'd want — we'll add our product shots and logo."
          value={changeRequest}
          onChange={(e) => setChangeRequest(e.target.value)}
        />
        <p className="mt-1 text-[11px] text-text-muted">
          Since this is a fixed-price sale, there’s no author review step — these terms apply automatically on purchase.
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button
          className="flex-1"
          disabled={pending}
          onClick={() =>
            onSubmit({
              brandCategory,
              brandName: brandName.trim(),
              changeRequest: changeRequest.trim(),
              removeMedia,
            })
          }
        >
          {pending ? "Processing..." : `Buy Now — ${formatAUD(listing.floorPrice)}`}
        </Button>
      </div>
    </ModalShell>
  );
}

function CreateListingModal({
  listable,
  categories,
  pending,
  onClose,
  onSubmit,
}: {
  listable: { id: string; title: string; category: string }[];
  categories: string[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (data: {
    articleId: string;
    saleType: "auction" | "fixed";
    floorPrice: number;
    reservePrice: number | null;
    allowedCategories: string[];
    durationDays: number;
  }) => void;
}) {
  const [articleId, setArticleId] = useState(listable[0]?.id ?? "");
  const [saleType, setSaleType] = useState<"auction" | "fixed">("auction");
  const [floor, setFloor] = useState("100");
  const [reserve, setReserve] = useState("");
  const [duration, setDuration] = useState("7");
  const [allowed, setAllowed] = useState<string[]>([]);

  function toggle(cat: string) {
    setAllowed((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }

  return (
    <ModalShell onClose={onClose}>
      <h3 className="mb-1 font-heading text-lg font-bold text-text-main">Sell an Article’s Ownership</h3>
      <p className="mb-4 text-[12.5px] text-text-muted">
        You keep your verified byline forever — only commercial ownership and branding transfer to the buyer.
      </p>

      <div className="mb-4">
        <label className={formLabel}>Article</label>
        <select className={formControl} value={articleId} onChange={(e) => setArticleId(e.target.value)}>
          {listable.map((a) => (
            <option key={a.id} value={a.id}>{a.title}</option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className={formLabel}>Sale type</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSaleType("auction")}
            className={cn(
              "cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors",
              saleType === "auction" ? "border-primary bg-primary-glow" : "border-line bg-bg-primary hover:border-line-hover",
            )}
          >
            <div className="text-[13px] font-semibold text-text-main">Auction</div>
            <div className="text-[11px] text-text-muted">Members make offers; you pick the winner</div>
          </button>
          <button
            type="button"
            onClick={() => setSaleType("fixed")}
            className={cn(
              "cursor-pointer rounded-lg border px-3 py-2.5 text-left transition-colors",
              saleType === "fixed" ? "border-primary bg-primary-glow" : "border-line bg-bg-primary hover:border-line-hover",
            )}
          >
            <div className="text-[13px] font-semibold text-text-main">Fixed Price</div>
            <div className="text-[11px] text-text-muted">First buyer to click Buy Now gets it, instantly</div>
          </button>
        </div>
      </div>

      {saleType === "auction" ? (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div>
            <label className={formLabel}>Floor price (AUD)</label>
            <input type="number" min="50" step="1" className={formControl} value={floor} onChange={(e) => setFloor(e.target.value)} />
          </div>
          <div>
            <label className={formLabel}>Reserve (optional)</label>
            <input type="number" step="1" className={formControl} placeholder="≥ floor" value={reserve} onChange={(e) => setReserve(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="mb-4">
          <label className={formLabel}>Price (AUD)</label>
          <input type="number" min="50" step="1" className={formControl} value={floor} onChange={(e) => setFloor(e.target.value)} />
          <p className="mt-1 text-[11px] text-text-muted">The exact amount a buyer pays — no bidding, no negotiation.</p>
        </div>
      )}

      <div className="mb-4">
        <label className={formLabel}>{saleType === "fixed" ? "Listing length (days)" : "Auction length (days)"}</label>
        <input type="number" min="1" step="1" className={formControl} value={duration} onChange={(e) => setDuration(e.target.value)} />
      </div>

      <div className="mb-5">
        <label className={formLabel}>Allowed buyer categories (brand-safety)</label>
        <p className="mb-2 text-[11px] text-text-muted">Leave all unchecked to allow any category.</p>
        <div className="flex flex-wrap gap-1.5">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                allowed.includes(c)
                  ? "border-primary bg-primary-glow text-primary"
                  : "border-line bg-bg-primary text-text-muted hover:border-line-hover",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button
          className="flex-1"
          disabled={pending || !articleId}
          onClick={() =>
            onSubmit({
              articleId,
              saleType,
              floorPrice: Number(floor),
              reservePrice: saleType === "auction" && reserve.trim() ? Number(reserve) : null,
              allowedCategories: allowed,
              durationDays: Number(duration),
            })
          }
        >
          {pending ? "Listing..." : saleType === "fixed" ? "List at Fixed Price" : "Open Auction"}
        </Button>
      </div>
    </ModalShell>
  );
}
