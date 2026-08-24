"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { formControl, formLabel } from "@/components/ui/Form";
import { dashCard, dashHeading, StatChip } from "@/components/ui/DashboardKit";
import { BarChartIcon, DollarSignIcon, ShoppingCartIcon } from "@/components/ui/icons";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";
import type { AuthorListing, PanelListing } from "@/lib/marketplace";

import { acceptBid, createListing, placeBid } from "./actions";

function formatAUD(n: number): string {
  return `A$${n.toLocaleString("en-AU", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PanelMarketplace({
  open,
  mine,
  listable,
  categories,
}: {
  open: PanelListing[];
  mine: AuthorListing[];
  listable: { id: string; title: string; category: string }[];
  categories: string[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"market" | "mine">("market");
  const [isPending, startTransition] = useTransition();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [bidOn, setBidOn] = useState<PanelListing | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const timeLeft = (iso: string) => {
    if (!mounted) return "";
    const ms = new Date(iso).getTime() - Date.now();
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

  const livePlacements = mine.filter((m) => m.placement?.status === "live").length;
  const totalBids = mine.reduce((s, m) => s + m.bidCount, 0);

  return (
    <>
      <ViewHeader
        title="Stakeholder Panel"
        subtitle="A private marketplace where members bid to sponsor articles. Authors accept the winning offer; branding is always labeled."
        actions={
          listable.length > 0 || mine.length > 0 ? (
            <Button size="sm" onClick={() => setShowCreate(true)} disabled={listable.length === 0}>
              List an Article
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid grid-cols-3 gap-4 max-[560px]:grid-cols-1">
        <StatChip icon={<ShoppingCartIcon className="size-4" />} value={open.length} label="Open listings" />
        <StatChip icon={<BarChartIcon className="size-4" />} value={totalBids} label="Bids on my articles" />
        <StatChip icon={<DollarSignIcon className="size-4" />} value={livePlacements} label="Live placements" accent />
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 border-b border-line">
        {([["market", "Marketplace"], ["mine", "My Listings"]] as const).map(([key, label]) => (
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
          </button>
        ))}
      </div>

      {/* Marketplace tab */}
      {tab === "market" && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-4">
          {open.length === 0 ? (
            <div className={cn(dashCard, "col-[1/-1]")}>
              <p className="p-8 text-center text-[13px] text-text-muted">
                No articles are open for sponsorship right now. Check back soon.
              </p>
            </div>
          ) : (
            open.map((l) => (
              <div key={l.auctionId} className="flex flex-col rounded-xl border border-line bg-bg-secondary p-5">
                <div className="mb-2 flex items-center justify-between text-[11px] text-text-muted">
                  <span className="rounded bg-primary-glow px-2 py-0.5 font-bold text-primary uppercase">{l.category}</span>
                  <span>{timeLeft(l.endsAt)}</span>
                </div>
                <Link href={`/article?id=${l.articleId}`} className="mb-1 font-heading text-[15px] font-bold text-text-main hover:text-primary">
                  {l.title}
                </Link>
                <p className="mb-3 line-clamp-2 flex-1 text-[12.5px] text-text-muted">{l.summary}</p>
                <div className="mb-3 text-[11.5px] text-text-muted">By {l.author}</div>

                <div className="mb-3 flex items-center justify-between rounded-lg border border-line bg-bg-primary px-3 py-2">
                  <div>
                    <div className="text-[10px] text-text-muted uppercase">{l.topBid > 0 ? "Top bid" : "Floor price"}</div>
                    <div className="font-heading text-base font-bold text-text-main">
                      {formatAUD(l.topBid > 0 ? l.topBid : l.floorPrice)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[10px] text-text-muted uppercase">Bids</div>
                    <div className="font-semibold text-text-main">{l.bidCount}</div>
                  </div>
                </div>

                {l.myBid != null && (
                  <p className="mb-2 text-[11px] font-semibold text-success">Your bid: {formatAUD(l.myBid)}</p>
                )}

                {l.isOwn ? (
                  <p className="rounded-lg bg-bg-tertiary px-3 py-2 text-center text-[11.5px] text-text-muted">
                    Your article — manage it under “My Listings”.
                  </p>
                ) : (
                  <Button size="sm" className="w-full" onClick={() => setBidOn(l)}>
                    {l.myBid != null ? "Raise Bid" : "Place Bid"}
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
                You haven’t listed any articles for sponsorship yet.
                {listable.length > 0 && " Click “List an Article” to open your first sponsorship auction."}
              </p>
            </div>
          ) : (
            mine.map((m) => (
              <div key={m.auctionId} className={dashCard}>
                <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <Link href={`/article?id=${m.articleId}`} className="font-heading text-[15px] font-bold text-text-main hover:text-primary">
                      {m.title}
                    </Link>
                    <div className="mt-0.5 text-[11.5px] text-text-muted">
                      Floor {formatAUD(m.floorPrice)}
                      {m.reservePrice != null && ` · Reserve ${formatAUD(m.reservePrice)}`}
                      {" · "}
                      {mounted ? timeLeft(m.endsAt) : ""}
                    </div>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[11px] font-bold",
                      m.status === "open" && "bg-primary-glow text-primary",
                      m.status === "settled" && "bg-success/10 text-success",
                      m.status === "canceled" && "bg-danger/10 text-danger",
                    )}
                  >
                    {m.status === "settled" ? "Sponsor placed" : m.status}
                  </span>
                </div>

                {/* Placement (settled) */}
                {m.placement && (
                  <div className="mb-3 rounded-lg border border-success/30 bg-success/5 p-3 text-[12.5px]">
                    <span className="font-semibold text-success">Sponsored by {m.placement.brandName}</span>
                    {m.placement.tagline && <span className="text-text-muted"> — “{m.placement.tagline}”</span>}
                    {m.placement.amount != null && (
                      <span className="text-text-muted"> · Settled at {formatAUD(m.placement.amount)}</span>
                    )}
                  </div>
                )}

                {/* Bids */}
                {m.bids.length === 0 ? (
                  <p className="rounded-lg bg-bg-tertiary px-3 py-3 text-center text-[12px] text-text-muted">
                    No bids yet.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-line">
                    {m.bids.map((b) => (
                      <div key={b.bidId} className="flex items-center justify-between gap-3 border-b border-line px-3 py-2 last:border-0">
                        <div className="min-w-0">
                          <span className="text-[13px] font-semibold text-text-main">{b.bidder}</span>
                          <span className="ml-2 text-[13px] text-text-main">{formatAUD(b.amount)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "rounded px-2 py-0.5 text-[10px] font-bold uppercase",
                              b.status === "active" && "bg-primary-glow text-primary",
                              b.status === "won" && "bg-success/10 text-success",
                              b.status === "outbid" && "bg-bg-tertiary text-text-muted",
                              b.status === "lost" && "bg-bg-tertiary text-text-muted",
                            )}
                          >
                            {b.status}
                          </span>
                          {m.status === "open" && (b.status === "active" || b.status === "outbid") && (
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={isPending}
                              onClick={() => {
                                const tagline = window.prompt(
                                  `Accept ${b.bidder}'s bid of ${formatAUD(b.amount)}? Optional sponsor tagline to show on the article:`,
                                  "",
                                );
                                if (tagline === null) return; // cancelled
                                startTransition(async () => {
                                  const res = await acceptBid({ bidId: b.bidId, tagline });
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
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Bid modal */}
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

      {/* Create listing modal */}
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
      <div className="fixed top-1/2 left-1/2 z-50 w-[min(460px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl border border-line bg-bg-secondary p-6 shadow-card max-h-[90vh]">
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
  onSubmit: (data: { amount: number; brandCategory: string; autoBidCeiling: number | null }) => void;
}) {
  const options = listing.allowedCategories.length > 0 ? listing.allowedCategories : categories;
  const [amount, setAmount] = useState(String(listing.minNextBid));
  const [brandCategory, setBrandCategory] = useState(options[0] ?? "");
  const [ceiling, setCeiling] = useState("");

  return (
    <ModalShell onClose={onClose}>
      <h3 className="mb-1 font-heading text-lg font-bold text-text-main">Place a Sponsorship Bid</h3>
      <p className="mb-4 text-[12.5px] text-text-muted">
        On “{listing.title}”. Minimum bid {formatAUD(listing.minNextBid)}. Your bid is an offer — the author must accept it before any branding appears.
      </p>

      <div className="mb-4">
        <label className={formLabel}>Bid amount (AUD)</label>
        <input type="number" min={listing.minNextBid} step="1" className={formControl} value={amount} onChange={(e) => setAmount(e.target.value)} />
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
            This article only accepts sponsors in: {listing.allowedCategories.join(", ")}.
          </p>
        )}
      </div>

      <div className="mb-5">
        <label className={formLabel}>Auto-bid ceiling (optional)</label>
        <input type="number" step="1" className={formControl} placeholder="Max you'd auto-bid to" value={ceiling} onChange={(e) => setCeiling(e.target.value)} />
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
              autoBidCeiling: ceiling.trim() ? Number(ceiling) : null,
            })
          }
        >
          {pending ? "Placing..." : "Place Bid"}
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
    floorPrice: number;
    reservePrice: number | null;
    allowedCategories: string[];
    durationDays: number;
  }) => void;
}) {
  const [articleId, setArticleId] = useState(listable[0]?.id ?? "");
  const [floor, setFloor] = useState("50");
  const [reserve, setReserve] = useState("");
  const [duration, setDuration] = useState("7");
  const [allowed, setAllowed] = useState<string[]>([]);

  function toggle(cat: string) {
    setAllowed((prev) => (prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]));
  }

  return (
    <ModalShell onClose={onClose}>
      <h3 className="mb-1 font-heading text-lg font-bold text-text-main">List an Article for Sponsorship</h3>
      <p className="mb-4 text-[12.5px] text-text-muted">
        Opens a second-price auction. Members bid; you accept the winner. The article stays public and gains a labeled sponsor.
      </p>

      <div className="mb-4">
        <label className={formLabel}>Article</label>
        <select className={formControl} value={articleId} onChange={(e) => setArticleId(e.target.value)}>
          {listable.map((a) => (
            <option key={a.id} value={a.id}>{a.title}</option>
          ))}
        </select>
      </div>

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

      <div className="mb-4">
        <label className={formLabel}>Auction length (days)</label>
        <input type="number" min="1" step="1" className={formControl} value={duration} onChange={(e) => setDuration(e.target.value)} />
      </div>

      <div className="mb-5">
        <label className={formLabel}>Allowed sponsor categories (brand-safety)</label>
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
              floorPrice: Number(floor),
              reservePrice: reserve.trim() ? Number(reserve) : null,
              allowedCategories: allowed,
              durationDays: Number(duration),
            })
          }
        >
          {pending ? "Listing..." : "Open Auction"}
        </Button>
      </div>
    </ModalShell>
  );
}
