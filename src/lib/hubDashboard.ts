import "server-only";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { appealTakedownFor, fileEditorialAppealFor, listAppealsFor } from "@/lib/appeals";
import {
  activateFromCheckoutSession,
  BillingError,
  createPortalUrl,
  hasActivePaidPlan,
  startCheckoutFor,
} from "@/lib/billing";
import { getTeamAnalytics } from "@/lib/dashboard";
import { getPlan, getSubmissionAllowance } from "@/lib/entitlements";
import { HubError, type HubCompany } from "@/lib/hubCompany";
import { StorageUploadError, storeUpload } from "@/lib/mediaUpload";
import { getMyNotifications, markAllNotificationsReadFor, markNotificationReadFor } from "@/lib/notifications";
import { PLAN_BENEFITS, PLAN_HIGHLIGHTS } from "@/lib/planBenefits";
import { EXTRA_SEAT_MONTHLY_CENTS, EXTRA_SEAT_YEARLY_CENTS, PLAN_CODES, PLANS } from "@/lib/plans";
import { setAvatarFor, updateProfileFor } from "@/lib/profile";

/**
 * The rest of the company dashboard for the MYHitch app (through the hub):
 * plan and billing, notifications, My Profile, team analytics and appeals.
 * Each one acts on the signed-in hub user exactly as the Lens website does for
 * them, using the website's own functions.
 */

// ---------------------------------------------------------------------------
// Plan and billing
// ---------------------------------------------------------------------------

const dollars = (cents: number | null) => (cents === null ? null : cents / 100);

export async function billing(ctx: HubCompany) {
  const userId = ctx.user.id;
  const [plan, sub, ownsPaidPlan, allowance] = await Promise.all([
    getPlan(userId),
    prisma.subscription.findUnique({
      where: { userId },
      select: { plan: true, status: true, interval: true, currentPeriodEnd: true, cancelAtPeriodEnd: true, extraSeats: true },
    }),
    hasActivePaidPlan(userId),
    getSubmissionAllowance(userId),
  ]);
  // Their own subscription, when it's the plan they're on (not one inherited from a company).
  const own = sub && sub.plan === plan.code && plan.code !== "free" ? sub : null;
  return {
    plan: plan.code,
    planName: plan.name,
    interval: own?.interval ?? null,
    status: own?.status ?? "active",
    currentPeriodEnd: own?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: own?.cancelAtPeriodEnd ?? false,
    extraSeats: own?.extraSeats ?? 0,
    ownsPaidPlan,
    submissions: { used: allowance.used, limit: allowance.limit },
    extraSeatPrice: { month: dollars(EXTRA_SEAT_MONTHLY_CENTS), year: dollars(EXTRA_SEAT_YEARLY_CENTS) },
    plans: PLAN_CODES.map((code) => {
      const p = PLANS[code];
      return {
        code,
        name: p.name,
        monthly: dollars(p.monthlyCents),
        yearly: dollars(p.yearlyCents),
        benefits: PLAN_HIGHLIGHTS[code],
        comingSoon: PLAN_BENEFITS.filter((b) => b.comingSoon && b.has(p.entitlements)).map((b) => b.label),
      };
    }),
  };
}

export async function checkout(ctx: HubCompany, input: { plan?: unknown; interval?: unknown }) {
  const result = await startCheckoutFor(ctx.user.id, input.plan, input.interval);
  if ("error" in result) throw new HubError(result.status, result.error);
  return result.url;
}

export async function activate(ctx: HubCompany, input: { sessionId?: unknown }) {
  const sessionId = String(input.sessionId ?? "").trim();
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new HubError(400, "That checkout session isn't valid.");
  try {
    await activateFromCheckoutSession(sessionId, ctx.user.id);
  } catch (error) {
    if (error instanceof BillingError) throw new HubError(400, error.message);
    console.error("[billing] activation failed", error);
    throw new HubError(
      502,
      "We couldn't confirm your payment yet. If you were charged, your plan will appear shortly; contact support if it doesn't.",
    );
  }
  revalidatePath("/", "layout");
  return billing(ctx);
}

export async function portal(ctx: HubCompany) {
  try {
    return await createPortalUrl(ctx.user.id);
  } catch (error) {
    if (error instanceof BillingError) throw new HubError(400, error.message);
    console.error("[billing] portal failed", { error: error instanceof Error ? error.message : String(error) });
    throw new HubError(502, "We couldn't open billing right now. Please try again shortly.");
  }
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export async function notifications(ctx: HubCompany) {
  const { items, unreadCount } = await getMyNotifications(ctx.user.id, 50);
  return {
    items: items.map((n) => ({ id: n.id, type: n.type, text: n.text, read: n.read, createdAt: n.createdAt })),
    unreadCount,
  };
}

export async function readNotification(ctx: HubCompany, id: string) {
  if (!(await markNotificationReadFor(ctx.user.id, id))) throw new HubError(404, "Notification not found.");
  revalidatePath("/", "layout");
}

export async function readAllNotifications(ctx: HubCompany) {
  await markAllNotificationsReadFor(ctx.user.id);
  revalidatePath("/", "layout");
}

// ---------------------------------------------------------------------------
// My Profile
// ---------------------------------------------------------------------------

export async function profile(ctx: HubCompany) {
  const user = await prisma.user.findUnique({
    where: { id: ctx.user.id },
    select: {
      username: true,
      email: true,
      displayName: true,
      profile: { select: { bio: true, website: true, country: true, abn: true, avatarUrl: true } },
    },
  });
  if (!user) throw new HubError(401, "Please open your Lens account again.");
  return {
    username: user.username,
    email: user.email,
    displayName: user.displayName,
    bio: user.profile?.bio ?? null,
    website: user.profile?.website ?? null,
    country: user.profile?.country ?? null,
    abn: user.profile?.abn ?? null,
    avatarUrl: user.profile?.avatarUrl ?? null,
  };
}

/**
 * As the website's profile form. A field left out keeps its current value;
 * anything else in the body (e.g. avatarUrl, saved by the avatar upload) is ignored.
 */
export async function updateMyProfile(ctx: HubCompany, input: Record<string, unknown>) {
  const current = await profile(ctx);
  const field = (key: "displayName" | "bio" | "website" | "country" | "abn") => {
    const value = input[key];
    if (value === undefined) return current[key] ?? "";
    return value === null ? "" : String(value);
  };
  const result = await updateProfileFor(ctx.user.id, {
    displayName: field("displayName"),
    bio: field("bio"),
    website: field("website"),
    country: field("country"),
    abn: field("abn"),
  });
  if ("error" in result) throw new HubError(400, result.error);
  revalidatePath("/profile", "layout");
  return profile(ctx);
}

const AVATAR_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const AVATAR_MAX_BYTES = 10 * 1024 * 1024;

/** A new profile photo (multipart field `file`), stored as /api/upload stores images. */
export async function uploadAvatar(ctx: HubCompany, request: Request) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || !(file instanceof File)) throw new HubError(400, "No file provided");
  if (!AVATAR_TYPES.has(file.type)) throw new HubError(400, "Choose a JPEG, PNG, WEBP or GIF picture.");
  if (file.size > AVATAR_MAX_BYTES) throw new HubError(400, "That picture is too big. The limit is 10 MB.");

  let url: string;
  try {
    ({ url } = await storeUpload({
      bytes: Buffer.from(await file.arrayBuffer()),
      type: file.type,
      uploaderId: ctx.user.id,
      uploaderName: ctx.user.displayName || "Author",
    }));
  } catch (error) {
    if (error instanceof StorageUploadError) throw new HubError(502, error.message);
    throw error;
  }
  const result = await setAvatarFor(ctx.user.id, url);
  if ("error" in result) throw new HubError(400, result.error);
  revalidatePath("/", "layout");
  return { avatarUrl: url };
}

// ---------------------------------------------------------------------------
// Team analytics
// ---------------------------------------------------------------------------

export async function analytics(ctx: HubCompany) {
  const team = await getTeamAnalytics(ctx.user.id);
  if (!team) return { locked: true as const, message: "Team analytics come with Lens Professional or Business." };
  const published = await prisma.article.findMany({
    where: { id: { in: team.data.articles.map((a) => a.id) } },
    select: { id: true, publishedAt: true },
  });
  const publishedAt = new Map(published.map((a) => [a.id, a.publishedAt?.toISOString() ?? null]));
  return {
    locked: false as const,
    totals: { views: team.data.totalViews, followers: team.data.totalFollowers, earnings: team.data.totalEarnings },
    articles: team.data.articles.map((a) => ({
      id: a.id,
      title: a.title,
      views: a.views,
      likes: a.likes,
      earnings: a.earnings,
      publishedAt: publishedAt.get(a.id) ?? null,
      author: a.author,
    })),
    categories: team.data.categoryShares.map((c) => ({ name: c.label, share: c.percent })),
    audience: team.insights,
  };
}

// ---------------------------------------------------------------------------
// Appeals (own articles)
// ---------------------------------------------------------------------------

export async function appeals(ctx: HubCompany) {
  return { appeals: await listAppealsFor(ctx.user.id) };
}

export async function fileAppeal(
  ctx: HubCompany,
  articleId: string,
  input: { kind?: unknown; reason?: unknown; justify?: unknown; text?: unknown },
): Promise<string> {
  const author = { id: ctx.user.id, name: ctx.user.displayName };
  let result;
  if (input.kind === "editorial") {
    result = await fileEditorialAppealFor(author, {
      articleId,
      reason: String(input.reason ?? ""),
      justify: String(input.justify ?? ""),
    });
  } else if (input.kind === "takedown") {
    result = await appealTakedownFor(author, articleId, String(input.text ?? ""));
  } else {
    throw new HubError(400, "Choose an editorial appeal or a takedown appeal.");
  }
  if ("error" in result) throw new HubError(result.status, result.error);
  revalidatePath("/author-dashboard");
  return result.id;
}
