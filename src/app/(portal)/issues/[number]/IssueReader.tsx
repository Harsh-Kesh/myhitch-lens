"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { IssueManifest } from "@/lib/magazineIssues";

/**
 * The flipbook reader for a released issue: spreads with a page turn on wide
 * screens, one page at a time on phones; arrows, keys and swipes; contents,
 * page thumbnails, search, zoom and full screen. Links and videos the
 * designer placed stay live on top of the page images.
 */

const BTN = "flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-lg px-2 text-sm text-white/85 transition hover:bg-white/10 hover:text-white disabled:opacity-30";

export function IssueReader({ issue, startPage }: { issue: IssueManifest; startPage: number }) {
  const count = issue.pages.length;
  const wrap = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 1200, h: 800 });
  const [single, setSingle] = useState(false);
  const [page, setPage] = useState(Math.min(startPage, count));
  const [turn, setTurn] = useState<{ dir: 1 | -1; to: number } | null>(null);
  const [panel, setPanel] = useState<"contents" | "pages" | "search" | null>(null);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      setSize({ w: e.contentRect.width, h: e.contentRect.height });
      setSingle(e.contentRect.width < 760);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const spreadOf = useCallback(
    (n: number): [number | null, number | null] => {
      if (single) return [n, null];
      if (n <= 1) return [null, 1];
      const left = n % 2 === 0 ? n : n - 1;
      return [left, left + 1 <= count ? left + 1 : null];
    },
    [single, count],
  );
  const [left, right] = spreadOf(page);
  const firstOf = (n: number) => (single ? n : n <= 1 ? 1 : n % 2 === 0 ? n : n - 1);
  const nextStart = single ? page + 1 : page <= 1 ? 2 : (left ?? 0) + 2;
  const prevStart = single ? page - 1 : page <= 1 ? 0 : left === 2 ? 1 : (left ?? 0) - 2;

  const pagesShown = single ? 1 : 2;
  const scale = Math.min((size.w - 24) / (issue.width * pagesShown), (size.h - 24) / issue.height) * zoom;
  const box = { w: issue.width * scale, h: issue.height * scale };

  const go = (to: number) => {
    if (turn) return;
    const target = firstOf(Math.max(1, Math.min(count, to)));
    if (target === page) return;
    if (reduced.current || single || zoom > 1 || Math.abs(target - page) > 2) return setPage(target);
    setTurn({ dir: target > page ? 1 : -1, to: target });
    setTimeout(() => {
      setPage(target);
      setTurn(null);
    }, 620);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof Element && e.target.closest("input, textarea")) return;
      if (e.key === "ArrowRight") go(nextStart);
      if (e.key === "ArrowLeft") go(prevStart);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // keep the address on the page being read, so it can be shared or resumed
  useEffect(() => {
    window.history.replaceState(null, "", `?page=${page}`);
  }, [page]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return issue.pages.flatMap((p) => {
      const i = p.text.toLowerCase().indexOf(q);
      return i < 0 ? [] : [{ page: p.n, snippet: `…${p.text.slice(Math.max(0, i - 40), i + q.length + 60)}…` }];
    });
  }, [query, issue.pages]);

  const face = (n: number | null, live = true) => {
    const p = n ? issue.pages[n - 1] : null;
    return (
      <div style={{ width: box.w, height: box.h, position: "relative", overflow: "hidden", background: p ? "#fff" : "transparent" }}>
        {p && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.image} alt={`Page ${p.n}`} draggable={false} style={{ width: "100%", height: "100%", display: "block" }} />
            {live &&
              p.links.map((l, i) =>
                l.href ? (
                  <a key={i} href={l.href} target="_blank" rel="noopener noreferrer" aria-label="Link" style={{ position: "absolute", left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.w * 100}%`, height: `${l.h * 100}%` }} />
                ) : (
                  <button key={i} type="button" aria-label={`Go to page ${l.page}`} onClick={() => go(l.page!)} style={{ position: "absolute", left: `${l.x * 100}%`, top: `${l.y * 100}%`, width: `${l.w * 100}%`, height: `${l.h * 100}%` }} />
                ),
              )}
            {live &&
              p.videos.map((v, i) => (
                <iframe key={i} src={v.src} title="Video" allow="encrypted-media; picture-in-picture" allowFullScreen loading="lazy" style={{ position: "absolute", left: `${v.x * 100}%`, top: `${v.y * 100}%`, width: `${v.w * 100}%`, height: `${v.h * 100}%`, border: 0 }} />
              ))}
          </>
        )}
      </div>
    );
  };

  const [tl, tr] = turn ? spreadOf(turn.to) : [null, null];
  const under = turn ? (turn.dir > 0 ? [left, tr] : [tl, right]) : [left, right];
  const swipe = useRef<number | null>(null);

  return (
    <div ref={wrap} className="flex h-[calc(100vh-0px)] flex-col bg-[#111318] text-white">
      <style>{`@keyframes leaf-next{from{transform:rotateY(0)}to{transform:rotateY(-180deg)}}@keyframes leaf-prev{from{transform:rotateY(0)}to{transform:rotateY(180deg)}}`}</style>
      <div className="flex h-14 shrink-0 items-center gap-1 border-b border-white/10 px-3">
        <Link href="/issues" className={BTN}>
          ← Issues
        </Link>
        <p className="mx-2 min-w-0 flex-1 truncate text-sm font-semibold">{issue.title}</p>
        <button type="button" className={BTN} onClick={() => setPanel((p) => (p === "contents" ? null : "contents"))}>
          Contents
        </button>
        <button type="button" className={BTN} onClick={() => setPanel((p) => (p === "pages" ? null : "pages"))}>
          Pages
        </button>
        <button type="button" className={BTN} onClick={() => setPanel((p) => (p === "search" ? null : "search"))}>
          Search
        </button>
        <button type="button" className={BTN} onClick={() => setZoom((z) => (z >= 2 ? 1 : z + 0.5))} aria-label="Zoom">
          {zoom >= 2 ? "−" : "+"}
        </button>
        <button type="button" className={BTN} onClick={() => (document.fullscreenElement ? document.exitFullscreen() : wrap.current?.requestFullscreen())} aria-label="Full screen">
          ⤢
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {panel && (
          <aside className="absolute inset-y-0 left-0 z-20 w-80 max-w-[85vw] overflow-y-auto border-r border-white/10 bg-[#16181f] p-3">
            {panel === "contents" && (
              <ol className="space-y-1">
                {issue.contents.map((c, i) => (
                  <li key={i}>
                    <button type="button" className="flex w-full gap-3 rounded-lg px-2 py-2 text-left hover:bg-white/10" onClick={() => (go(c.page), setPanel(null))}>
                      <span className="w-7 shrink-0 text-right font-bold text-sky-300">{c.page}</span>
                      <span>
                        <span className="block text-sm">{c.title}</span>
                        <span className="block text-xs text-white/55">{[c.author, c.sponsor && `Sponsored by ${c.sponsor}`].filter(Boolean).join(" · ")}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            )}
            {panel === "pages" && (
              <ul className="grid grid-cols-2 gap-2">
                {issue.pages.map((p) => (
                  <li key={p.n}>
                    <button type="button" onClick={() => (go(p.n), setPanel(null))} className="block w-full overflow-hidden rounded ring-2 ring-transparent hover:ring-white/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.image} alt={`Page ${p.n}`} loading="lazy" className="block w-full" />
                    </button>
                    <span className="block text-center text-[11px] text-white/60">{p.n}</span>
                  </li>
                ))}
              </ul>
            )}
            {panel === "search" && (
              <>
                <input autoFocus className="h-10 w-full rounded-lg border border-white/15 bg-black/30 px-3 text-sm outline-none" placeholder="Words to find" value={query} onChange={(e) => setQuery(e.target.value)} />
                <ul className="mt-2 space-y-1">
                  {results.map((r, i) => (
                    <li key={i}>
                      <button type="button" className="w-full rounded-lg px-2 py-2 text-left text-xs hover:bg-white/10" onClick={() => go(r.page)}>
                        <span className="font-semibold text-sky-300">Page {r.page}</span>
                        <span className="mt-0.5 block text-white/70">{r.snippet}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </aside>
        )}
        <div
          ref={stage}
          className={`relative flex min-w-0 flex-1 items-center justify-center ${zoom > 1 ? "overflow-auto" : "overflow-hidden"}`}
          onPointerDown={(e) => (swipe.current = e.clientX)}
          onPointerUp={(e) => {
            if (swipe.current == null || zoom > 1) return;
            const dx = e.clientX - swipe.current;
            swipe.current = null;
            if (Math.abs(dx) > 60) go(dx < 0 ? nextStart : prevStart);
          }}
        >
          <div className="relative flex" style={{ perspective: 2400, filter: "drop-shadow(0 24px 40px rgba(0,0,0,0.55))" }}>
            {!single && <div style={{ width: box.w, height: box.h }}>{under[0] ? face(under[0]) : null}</div>}
            <div style={{ width: box.w, height: box.h }}>{single ? face(page) : under[1] ? face(under[1]) : null}</div>
            {turn && !single && (
              <div
                aria-hidden
                className="absolute top-0"
                style={{ width: box.w, height: box.h, left: turn.dir > 0 ? box.w : 0, transformOrigin: turn.dir > 0 ? "left center" : "right center", transformStyle: "preserve-3d", animation: `${turn.dir > 0 ? "leaf-next" : "leaf-prev"} 620ms cubic-bezier(.45,.05,.25,1) forwards` }}
              >
                <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>{face(turn.dir > 0 ? right : left, false)}</div>
                <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>{face(turn.dir > 0 ? tl : tr, false)}</div>
              </div>
            )}
          </div>
          <button type="button" className="absolute left-2 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-black/40 text-2xl hover:bg-black/70 disabled:opacity-20" disabled={prevStart < 1} onClick={() => go(prevStart)} aria-label="Previous page">
            ‹
          </button>
          <button type="button" className="absolute right-2 top-1/2 h-12 w-12 -translate-y-1/2 rounded-full bg-black/40 text-2xl hover:bg-black/70 disabled:opacity-20" disabled={nextStart > count} onClick={() => go(nextStart)} aria-label="Next page">
            ›
          </button>
        </div>
      </div>
      <div className="flex h-12 shrink-0 items-center gap-3 border-t border-white/10 px-4 text-xs text-white/70">
        <span className="tabular-nums">{single ? `Page ${page} of ${count}` : `${[left, right].filter(Boolean).join("–")} of ${count}`}</span>
        <input type="range" min={1} max={count} value={page} onChange={(e) => go(Number(e.target.value))} className="flex-1 accent-sky-400" aria-label="Go to page" />
      </div>
    </div>
  );
}
