"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { BellIcon } from "@/components/ui/icons";
import { cn } from "@/lib/cn";
import type { NotificationView } from "@/lib/notifications";
import { markAllNotificationsRead, markNotificationRead } from "@/app/(portal)/notifications/actions";

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationView[];
  unreadCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const [isPending, startTransition] = useTransition();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const PANEL_WIDTH = 320;

  // Positioned relative to the viewport (not the narrow sidebar column) so the
  // panel never gets clamped or overflow-clipped by whichever cramped parent
  // happens to render the bell. Right-aligning to the button would push the
  // panel's left edge negative in a column this narrow (the sidebar is only
  // ~280px wide), so anchor by `left` and clamp it into the viewport instead.
  function toggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const idealLeft = rect.right - PANEL_WIDTH;
      const left = Math.min(Math.max(idealLeft, 8), window.innerWidth - PANEL_WIDTH - 8);
      setPanelPos({ top: rect.bottom + 8, left });
    }
    setOpen((o) => !o);
  }

  useEffect(() => {
    if (!open) return;
    function onClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function handleMarkAll() {
    startTransition(async () => {
      await markAllNotificationsRead();
      router.refresh();
    });
  }

  function handleOpenOne(id: string, isRead: boolean) {
    if (isRead) return;
    startTransition(async () => {
      await markNotificationRead(id);
      router.refresh();
    });
  }

  return (
    <div className="shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
        aria-expanded={open}
        className="relative inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border border-line bg-bg-tertiary text-text-main transition-colors hover:border-line-hover hover:bg-surface-hover"
      >
        <BellIcon className="size-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-danger text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && panelPos && (
        <div
          ref={panelRef}
          style={{ position: "fixed", top: panelPos.top, left: panelPos.left }}
          className="z-50 max-h-[420px] w-[320px] max-w-[calc(100vw-16px)] overflow-y-auto rounded-xl border border-line bg-bg-secondary shadow-card"
        >
          <div className="sticky top-0 flex items-center justify-between border-b border-line bg-bg-secondary px-4 py-2.5">
            <span className="font-heading text-[13px] font-bold text-text-main">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={isPending}
                className="cursor-pointer text-[11px] font-semibold text-primary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark all read
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="p-6 text-center text-[12.5px] text-text-muted">No notifications yet.</p>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleOpenOne(n.id, n.read)}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-0.5 border-b border-line px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-surface-hover",
                    !n.read && "bg-primary-glow/40",
                  )}
                >
                  <span className="text-[12.5px] leading-[1.4] text-text-main">{n.text}</span>
                  <span className="text-[10.5px] text-text-muted">{timeAgo(n.createdAt)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
