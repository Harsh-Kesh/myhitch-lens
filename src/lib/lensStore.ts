import {
  defaultArticles,
  defaultBookmarks,
  defaultFollowed,
  defaultIntegrations,
  defaultNotifications,
  defaultQueue,
} from "@/data/defaults";
import type {
  Appeal,
  Article,
  Integrations,
  Notification,
  QueueItem,
  UserRole,
} from "@/lib/types";

/**
 * localStorage-backed persistence layer, a direct port of the `shared.js`
 * database helpers. Keys are unchanged so an existing browser profile keeps
 * its data after the migration.
 */

export const STORAGE_KEYS = {
  articles: "lens_articles",
  queue: "lens_queue",
  bookmarks: "lens_bookmarks",
  followed: "lens_followed",
  notifications: "lens_notifications",
  appeals: "lens_appeals",
  integrations: "lens_integrations",
  role: "lens_role",
  user: "lens_user",
} as const;

const isBrowser = () => typeof window !== "undefined";

/**
 * Broadcast whenever a value changes so subscribed components re-read. Replaces
 * the original habit of calling `injectSidebarMenu()` again by hand to redraw
 * the editorial queue badge.
 */
export const LENS_STORE_EVENT = "lens:store-changed";

/**
 * Parsed values are memoised per key so repeated reads return a stable
 * reference. `useSyncExternalStore` compares snapshots by identity, so parsing
 * fresh on every read would loop forever.
 */
const snapshotCache = new Map<string, unknown>();

function notifyStoreChange(): void {
  if (!isBrowser()) return;
  window.dispatchEvent(new Event(LENS_STORE_EVENT));
}

/** Subscribes to store changes, including writes from another tab. */
export function subscribeToLensStore(onChange: () => void): () => void {
  if (!isBrowser()) return () => {};

  const handleExternalWrite = () => {
    snapshotCache.clear();
    onChange();
  };

  window.addEventListener(LENS_STORE_EVENT, onChange);
  window.addEventListener("storage", handleExternalWrite);
  return () => {
    window.removeEventListener(LENS_STORE_EVENT, onChange);
    window.removeEventListener("storage", handleExternalWrite);
  };
}

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  if (snapshotCache.has(key)) return snapshotCache.get(key) as T;

  let value = fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw !== null) value = JSON.parse(raw) as T;
  } catch {
    /* corrupt entry - fall back to the seed data, as the original did */
  }
  snapshotCache.set(key, value);
  return value;
}

function write<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode / quota) - fail silently, as before */
  }
  snapshotCache.set(key, value);
  notifyStoreChange();
}

function readRaw(key: string, fallback: string): string {
  if (!isBrowser()) return fallback;
  return window.localStorage.getItem(key) ?? fallback;
}

function writeRaw(key: string, value: string): void {
  if (!isBrowser()) return;
  window.localStorage.setItem(key, value);
  notifyStoreChange();
}

/* --- Articles --- */
export const getArticles = () => read<Article[]>(STORAGE_KEYS.articles, defaultArticles);
export const saveArticles = (value: Article[]) => write(STORAGE_KEYS.articles, value);

/* --- Editorial queue --- */
export const getQueue = () => read<QueueItem[]>(STORAGE_KEYS.queue, defaultQueue);
export const saveQueue = (value: QueueItem[]) => write(STORAGE_KEYS.queue, value);

/* --- Bookmarks --- */
export const getBookmarks = () => read<string[]>(STORAGE_KEYS.bookmarks, defaultBookmarks);
export const saveBookmarks = (value: string[]) => write(STORAGE_KEYS.bookmarks, value);

/* --- Followed authors --- */
export const getFollowed = () => read<string[]>(STORAGE_KEYS.followed, defaultFollowed);
export const saveFollowed = (value: string[]) => write(STORAGE_KEYS.followed, value);

/* --- Notifications --- */
export const getNotifications = () =>
  read<Notification[]>(STORAGE_KEYS.notifications, defaultNotifications);
export const saveNotifications = (value: Notification[]) =>
  write(STORAGE_KEYS.notifications, value);

/* --- Governance appeals --- */
export const getAppeals = () => read<Appeal[]>(STORAGE_KEYS.appeals, []);
export const saveAppeals = (value: Appeal[]) => write(STORAGE_KEYS.appeals, value);

/* --- Integrations --- */
export const getIntegrations = () =>
  read<Integrations>(STORAGE_KEYS.integrations, defaultIntegrations);
export const saveIntegrations = (value: Integrations) =>
  write(STORAGE_KEYS.integrations, value);

/* --- Session identity --- */
export const getUserRole = () => readRaw(STORAGE_KEYS.role, "author") as UserRole;
export const setUserRole = (role: UserRole) => writeRaw(STORAGE_KEYS.role, role);

export const getUserName = () => readRaw(STORAGE_KEYS.user, "Dr. Sarah Chen");
export const setUserName = (name: string) => writeRaw(STORAGE_KEYS.user, name);

/** Preset display name for each simulated role. */
export const ROLE_NAMES: Record<UserRole, string> = {
  reader: "Markus Green",
  author: "Dr. Sarah Chen",
  editor: "Chief Editor Vance",
  admin: "Platform Admin",
};

/** Landing route for each simulated role. */
export const ROLE_HOME: Record<UserRole, string> = {
  reader: "/reader-dashboard",
  author: "/author-dashboard",
  editor: "/editorial",
  admin: "/editorial",
};

/**
 * Seeds every key that has not been written yet. Mirrors
 * `checkAndInitDatabase()` from the original script.
 */
export function checkAndInitDatabase(): void {
  if (!isBrowser()) return;
  const ls = window.localStorage;
  if (!ls.getItem(STORAGE_KEYS.articles)) saveArticles(defaultArticles);
  if (!ls.getItem(STORAGE_KEYS.queue)) saveQueue(defaultQueue);
  if (!ls.getItem(STORAGE_KEYS.bookmarks)) saveBookmarks(defaultBookmarks);
  if (!ls.getItem(STORAGE_KEYS.followed)) saveFollowed(defaultFollowed);
  if (!ls.getItem(STORAGE_KEYS.notifications)) saveNotifications(defaultNotifications);
  if (!ls.getItem(STORAGE_KEYS.appeals)) saveAppeals([]);
  if (!ls.getItem(STORAGE_KEYS.integrations)) saveIntegrations(defaultIntegrations);
  if (!ls.getItem(STORAGE_KEYS.role)) setUserRole("author");
  if (!ls.getItem(STORAGE_KEYS.user)) setUserName("Dr. Sarah Chen");
}

/** Prepends a system notification, as the role switcher used to do inline. */
export function pushNotification(text: string, type: Notification["type"] = "system"): void {
  const next = getNotifications();
  next.unshift({ id: Date.now(), type, date: "Just now", text });
  saveNotifications(next);
}
