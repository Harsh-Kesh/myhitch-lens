"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { formControl, formLabel } from "@/components/ui/Form";
import { ManageBusinessLink } from "@/components/ui/ManageBusinessLink";
import { Modal } from "@/components/ui/Modal";
import { ViewHeader } from "@/components/ui/ViewHeader";
import { cn } from "@/lib/cn";

import {
  approveCompanyArticle,
  changeExtraSeats,
  inviteSubAccount,
  rejectCompanyArticle,
  removeSubAccount,
  revokeInvite,
  submitCompanyArticle,
  type CompanyArticle,
  type CompanyInvite,
  type CompanyMember,
  type CompanyOverview,
  type CompanyReviewItem,
} from "./actions";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  in_review: "Awaiting your editor's review",
  changes_requested: "Changes requested",
  published: "Published",
  rejected: "Rejected",
};

export function CompanyDashboard({
  overview,
  articles,
  reviewQueue,
}: {
  overview: CompanyOverview;
  articles: CompanyArticle[];
  reviewQueue: CompanyReviewItem[];
}) {
  return (
    <>
      <ViewHeader
        title={overview.orgName}
        subtitle={
          overview.isOwner
            ? "Manage your team's seats and sub-accounts."
            : overview.myRole === "editor"
              ? "Review and publish your team's submissions."
              : "Write and submit articles for your team's editor to review."
        }
      />
      {overview.isOwner && <OwnerPanel overview={overview} />}
      {overview.myRole === "author" && <AuthorPanel articles={articles} />}
      {overview.myRole === "editor" && <EditorPanel queue={reviewQueue} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// Owner: seats + team management
// ---------------------------------------------------------------------------

function OwnerPanel({ overview }: { overview: CompanyOverview }) {
  const router = useRouter();
  const [showAdd, setShowAdd] = useState(false);
  const [isPending, startTransition] = useTransition();

  function doRemove(member: CompanyMember) {
    if (!confirm(`Remove ${member.displayName} from the company? Their account is kept but loses company access.`)) return;
    startTransition(async () => {
      const res = await removeSubAccount(member.id);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  function doRevoke(invite: CompanyInvite) {
    if (!confirm(`Cancel the invitation for ${invite.email}?`)) return;
    startTransition(async () => {
      const res = await revokeInvite(invite.id);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  const seatsUsed = overview.members.length + overview.invites.length;
  const seatPrice = overview.plan.interval === "year" ? "AU$60 per user per year" : "AU$5 per user per month";

  function setExtra(next: number) {
    startTransition(async () => {
      const res = await changeExtraSeats(next);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <>
      <div className={cn(dashCard, "mb-6")}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className={dashHeading}>Company Details</h3>
          <ManageBusinessLink className="text-[12.5px] font-semibold text-primary hover:underline">
            Edit in MYHitch Business
          </ManageBusinessLink>
        </div>
        {overview.plan.onBusiness ? (
          <>
            <p className="text-[13px] text-text-muted">
              Lens Business: using <span className="font-semibold text-text-main">{seatsUsed}</span> of{" "}
              <span className="font-semibold text-text-main">{overview.seats}</span> seats (
              {overview.plan.includedSeats} included
              {overview.plan.extraSeats > 0 ? ` + ${overview.plan.extraSeats} extra` : ""}).
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
              <span className="text-text-muted">Extra users ({seatPrice}):</span>
              <Button size="sm" variant="secondary" disabled={isPending || overview.plan.extraSeats === 0} onClick={() => setExtra(overview.plan.extraSeats - 1)}>
                −
              </Button>
              <span className="min-w-6 text-center font-semibold text-text-main">{overview.plan.extraSeats}</span>
              <Button size="sm" variant="secondary" disabled={isPending} onClick={() => setExtra(overview.plan.extraSeats + 1)}>
                +
              </Button>
            </div>
          </>
        ) : (
          <p className="text-[13px] text-text-muted">
            Your company isn&apos;t on a Lens Business plan. Team members already in your company keep their access, but
            adding more people needs{" "}
            <Link href="/pricing" className="font-semibold text-primary hover:underline">
              Lens Business
            </Link>
            .
          </p>
        )}
        <p className="mt-2 text-[13px] text-text-muted">
          Legal name:{" "}
          <span className="font-semibold text-text-main">{overview.orgName}</span>
        </p>
        <p className="mt-2 text-[13px] text-text-muted">
          ABN:{" "}
          <span className="font-semibold text-text-main">
            {overview.abn || "Not on file"}
          </span>
        </p>
        <p className="mt-2 text-[11.5px] text-text-muted">
          {overview.fromPortal
            ? "These details come from your MYHitch Business profile and can only be changed there."
            : "Showing the details we have on file. Once your business is approved in MYHitch Business, they are kept in sync with it."}
        </p>
      </div>

      <div className={dashCard}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className={dashHeading}>Team</h3>
          <Button
            size="sm"
            disabled={!overview.plan.onBusiness || seatsUsed >= overview.seats}
            onClick={() => setShowAdd(true)}
          >
            Invite team member
          </Button>
        </div>

        <div className="flex flex-col gap-2">
          {overview.members.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-line bg-bg-primary p-3">
              <div>
                <p className="text-[13.5px] font-semibold text-text-main">{m.displayName}</p>
                <p className="text-[11.5px] text-text-muted">
                  @{m.username} · joined {formatDate(m.createdAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded bg-bg-tertiary px-2 py-0.5 text-[10.5px] font-bold text-text-muted uppercase">
                  {m.isAdmin ? "Owner" : m.orgRole}
                </span>
                {!m.isAdmin && (
                  <Button size="sm" variant="secondary" disabled={isPending} onClick={() => doRemove(m)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>
          ))}
          {overview.invites.map((i) => (
            <div key={i.id} className="flex items-center justify-between rounded-lg border border-dashed border-line bg-bg-primary p-3">
              <div>
                <p className="text-[13.5px] font-semibold text-text-main">{i.displayName}</p>
                <p className="text-[11.5px] text-text-muted">
                  {i.email} · invited {formatDate(i.createdAt)} · joins when they sign in with this email
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="rounded bg-bg-tertiary px-2 py-0.5 text-[10.5px] font-bold text-text-muted uppercase">
                  Pending · {i.orgRole}
                </span>
                <Button size="sm" variant="secondary" disabled={isPending} onClick={() => doRevoke(i)}>
                  Cancel
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showAdd && <InviteModal onClose={() => setShowAdd(false)} />}
    </>
  );
}

function InviteModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [orgRole, setOrgRole] = useState<"author" | "editor">("author");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await inviteSubAccount({ email, displayName, orgRole });
      if ("error" in res) setError(res.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <Modal onClose={onClose} className="w-[min(420px,92vw)]">
      <h3 className="mb-1 font-heading text-lg font-bold text-text-main">Invite a team member</h3>
      <p className="mb-4 text-[12.5px] text-text-muted">
        They sign in with MYHitch using this email address and join your company automatically.
      </p>

      <div className="mb-3">
        <label className={formLabel}>Display name</label>
        <input className={formControl} value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
      </div>
      <div className="mb-3">
        <label className={formLabel}>Email</label>
        <input type="email" className={formControl} value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="mb-5">
        <label className={formLabel}>Role</label>
        <select className={formControl} value={orgRole} onChange={(e) => setOrgRole(e.target.value as "author" | "editor")}>
          <option value="author">Author — writes articles</option>
          <option value="editor">Editor — reviews and approves</option>
        </select>
      </div>

      {error && <p className="mb-4 text-[12.5px] text-danger">{error}</p>}

      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button className="flex-1" disabled={isPending} onClick={submit}>
          {isPending ? "Inviting..." : "Send invite"}
        </Button>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Author sub-account: a simple composer + their own submission history
// ---------------------------------------------------------------------------

function AuthorPanel({ articles }: { articles: CompanyArticle[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await submitCompanyArticle({ title, content });
      if ("error" in res) setError(res.error);
      else {
        setTitle("");
        setContent("");
        router.refresh();
      }
    });
  }

  return (
    <>
      <div className={cn(dashCard, "mb-6")}>
        <h3 className={dashHeading}>Write an article</h3>
        <div className="mb-3">
          <label className={formLabel}>Title</label>
          <input className={formControl} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="mb-3">
          <label className={formLabel}>Content</label>
          <textarea rows={8} className={formControl} value={content} onChange={(e) => setContent(e.target.value)} />
        </div>
        {error && <p className="mb-3 text-[12.5px] text-danger">{error}</p>}
        <Button disabled={isPending} onClick={submit}>
          {isPending ? "Submitting..." : "Submit to your editor"}
        </Button>
      </div>

      <div className={dashCard}>
        <h3 className={dashHeading}>My Articles</h3>
        {articles.length === 0 ? (
          <p className="p-6 text-center text-[13px] text-text-muted">Nothing submitted yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {articles.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-line bg-bg-primary p-3">
                <p className="text-[13.5px] font-semibold text-text-main">{a.title}</p>
                <span className="text-[11.5px] text-text-muted">{STATUS_LABEL[a.status] ?? a.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Editor sub-account: their own company's review queue
// ---------------------------------------------------------------------------

function EditorPanel({ queue }: { queue: CompanyReviewItem[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejecting, setRejecting] = useState<CompanyReviewItem | null>(null);

  function approve(id: string) {
    startTransition(async () => {
      const res = await approveCompanyArticle(id);
      if ("error" in res) alert(res.error);
      else router.refresh();
    });
  }

  return (
    <div className={dashCard}>
      <h3 className={dashHeading}>Review Queue ({queue.length})</h3>
      {queue.length === 0 ? (
        <p className="p-8 text-center text-[13px] text-text-muted">Nothing awaiting review.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {queue.map((item) => (
            <div key={item.id} className="rounded-lg border border-line bg-bg-primary p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-heading text-[15px] font-bold text-text-main">{item.title}</span>
                <span className="text-[11px] text-text-muted">{formatDate(item.submittedAt)}</span>
              </div>
              <p className="mb-3 text-[11.5px] text-text-muted">by {item.authorName}</p>
              <div className="flex gap-3">
                <Button size="sm" disabled={isPending} onClick={() => approve(item.id)}>
                  Approve &amp; Publish
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="border-[rgba(239,68,68,0.2)] text-danger"
                  disabled={isPending}
                  onClick={() => setRejecting(item)}
                >
                  Reject
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejecting && <RejectModal item={rejecting} onClose={() => setRejecting(null)} />}
    </div>
  );
}

function RejectModal({ item, onClose }: { item: CompanyReviewItem; onClose: () => void }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [reason, setReason] = useState("");

  function submit() {
    startTransition(async () => {
      const res = await rejectCompanyArticle(item.id, reason);
      if ("error" in res) alert(res.error);
      else {
        onClose();
        router.refresh();
      }
    });
  }

  return (
    <Modal onClose={onClose} className="w-[min(420px,92vw)]">
      <h3 className="mb-1 font-heading text-lg font-bold text-text-main">Reject &quot;{item.title}&quot;</h3>
      <p className="mb-4 text-[12.5px] text-text-muted">The author will see this reason.</p>
      <textarea
        rows={4}
        className={cn(formControl, "mb-5")}
        placeholder="Why is this being rejected?"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="flex gap-3">
        <Button variant="secondary" className="flex-1" onClick={onClose}>Cancel</Button>
        <Button
          className="flex-1 border-[rgba(239,68,68,0.2)] bg-danger text-white hover:bg-danger"
          disabled={isPending || !reason.trim()}
          onClick={submit}
        >
          {isPending ? "Rejecting..." : "Reject"}
        </Button>
      </div>
    </Modal>
  );
}
