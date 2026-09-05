"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent } from "react";

import { Button } from "@/components/ui/Button";
import { formControl, formLabel } from "@/components/ui/Form";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { ViewHeader } from "@/components/ui/ViewHeader";

import type { UserRole } from "@prisma/client";

import { ABN_COUNTRY } from "@/lib/platformConfig";
import { startStripeConnectOnboarding, type ConnectStatus } from "@/app/(portal)/author-dashboard/payoutActions";
import { becomeAuthor, changePassword, updateAvatar, updateProfile } from "./actions";

const COUNTRIES = [
  "Australia",
  "New Zealand",
  "United Kingdom",
  "United States",
  "Canada",
  "Singapore",
  "Other",
];

export function ProfileSettings({
  displayName,
  email,
  username,
  bio,
  website,
  country,
  abn,
  avatarUrl,
  role,
  connectStatus,
}: {
  displayName: string;
  email: string;
  username: string;
  bio: string;
  website: string;
  country: string;
  abn: string;
  avatarUrl: string | null;
  role: UserRole;
  connectStatus: ConnectStatus | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarPreview, setAvatarPreview] = useState(avatarUrl);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarMsg, setAvatarMsg] = useState<string | null>(null);

  async function handleAvatarSelected(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setAvatarMsg(null);
    setIsUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const uploadRes = await fetch("/api/upload", { method: "POST", body: formData });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok) {
        setAvatarMsg(uploadJson.error || "Upload failed.");
        return;
      }

      const res = await updateAvatar(uploadJson.url);
      if ("error" in res) {
        setAvatarMsg(res.error);
        return;
      }
      setAvatarPreview(uploadJson.url);
      router.refresh();
    } catch {
      setAvatarMsg("Upload failed — please try again.");
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  const [nameVal, setNameVal] = useState(displayName);
  const [bioVal, setBioVal] = useState(bio);
  const [websiteVal, setWebsiteVal] = useState(website);
  const [countryVal, setCountryVal] = useState(country);
  const [abnVal, setAbnVal] = useState(abn);
  const [profileMsg, setProfileMsg] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<string | null>(null);
  const [isPasswordPending, startPasswordTransition] = useTransition();
  const [isConnecting, startConnecting] = useTransition();
  const [isBecomingAuthor, startBecomingAuthor] = useTransition();
  const [becomeAuthorMsg, setBecomeAuthorMsg] = useState<string | null>(null);

  function doBecomeAuthor() {
    setBecomeAuthorMsg(null);
    startBecomingAuthor(async () => {
      const res = await becomeAuthor();
      if ("error" in res) setBecomeAuthorMsg(res.error);
      else window.location.href = "/author-dashboard";
    });
  }

  function doConnect() {
    startConnecting(async () => {
      const res = await startStripeConnectOnboarding();
      if ("error" in res) alert(res.error);
      else window.location.href = res.url;
    });
  }

  function saveProfile() {
    setProfileMsg(null);
    startTransition(async () => {
      const res = await updateProfile({
        displayName: nameVal,
        bio: bioVal,
        website: websiteVal,
        country: countryVal,
        abn: abnVal,
      });
      if ("error" in res) setProfileMsg(res.error);
      else {
        setProfileMsg(res.abnEntityName ? `Saved — ABN verified: ${res.abnEntityName}.` : "Saved.");
        router.refresh();
      }
    });
  }

  function savePassword() {
    setPasswordMsg(null);
    if (newPassword !== confirmPassword) {
      setPasswordMsg("New passwords don't match.");
      return;
    }
    startPasswordTransition(async () => {
      const res = await changePassword({ currentPassword, newPassword });
      if ("error" in res) setPasswordMsg(res.error);
      else {
        setPasswordMsg("Password updated.");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      }
    });
  }

  return (
    <>
      <ViewHeader title="My Profile" subtitle="Manage your account details, tax information, and password." />

      <div className={dashCard}>
        <h3 className={dashHeading}>Account Details</h3>

        <div className="mb-5 flex items-center gap-4">
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- user-uploaded content, may be an external Supabase Storage URL
            <img
              src={avatarPreview}
              alt={displayName}
              className="size-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-bg-tertiary text-xl font-bold text-text-muted">
              {displayName.charAt(0).toUpperCase() || "?"}
            </div>
          )}
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              onChange={handleAvatarSelected}
            />
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isUploadingAvatar}
              onClick={() => fileInputRef.current?.click()}
            >
              {isUploadingAvatar ? "Uploading..." : "Change Photo"}
            </Button>
            {avatarMsg && <p className="mt-1.5 text-[11.5px] text-text-muted">{avatarMsg}</p>}
          </div>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
          <div>
            <label className={formLabel}>Username</label>
            <input type="text" className={formControl} value={username} disabled />
          </div>
          <div>
            <label className={formLabel}>Email</label>
            <input type="text" className={formControl} value={email} disabled />
          </div>
        </div>

        <div className="mb-4">
          <label className={formLabel}>Display name</label>
          <input type="text" className={formControl} value={nameVal} onChange={(e) => setNameVal(e.target.value)} />
        </div>

        <div className="mb-4">
          <label className={formLabel}>Bio</label>
          <textarea rows={3} className={formControl} value={bioVal} onChange={(e) => setBioVal(e.target.value)} />
        </div>

        <div className="mb-4">
          <label className={formLabel}>Website</label>
          <input type="text" className={formControl} placeholder="https://…" value={websiteVal} onChange={(e) => setWebsiteVal(e.target.value)} />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
          <div>
            <label className={formLabel}>Country</label>
            <select className={formControl} value={countryVal} onChange={(e) => setCountryVal(e.target.value)}>
              <option value="">Select your country</option>
              {COUNTRIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          {countryVal === ABN_COUNTRY && (
            <div>
              <label className={formLabel}>ABN (optional)</label>
              <input type="text" className={formControl} placeholder="11 digit ABN" value={abnVal} onChange={(e) => setAbnVal(e.target.value)} />
            </div>
          )}
        </div>

        {profileMsg && <p className="mb-4 text-[12.5px] text-text-muted">{profileMsg}</p>}

        <Button disabled={isPending} onClick={saveProfile}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {role === "reader" && (
        <div className={dashCard + " mt-6"}>
          <h3 className={dashHeading}>Become an Author</h3>
          <p className="mb-4 text-[12.5px] text-text-muted">
            Want to publish your own articles on MYHitch Lens? Switch your account to an author account —
            it&apos;s free, instant, and you keep your existing profile and history.
          </p>
          {becomeAuthorMsg && <p className="mb-4 text-[12.5px] text-text-muted">{becomeAuthorMsg}</p>}
          <Button size="sm" disabled={isBecomingAuthor} onClick={doBecomeAuthor}>
            {isBecomingAuthor ? "Switching..." : "Become an Author"}
          </Button>
        </div>
      )}

      {connectStatus && (
        <div className={dashCard + " mt-6"}>
          <h3 className={dashHeading}>Payouts</h3>
          {!connectStatus.configured ? (
            <p className="text-[12.5px] text-text-muted">Payouts aren&apos;t set up yet — check back soon.</p>
          ) : !connectStatus.connected ? (
            <>
              <p className="mb-4 text-[12.5px] text-text-muted">
                Connect a Stripe account to withdraw your earnings from the Author Dashboard.
              </p>
              <Button size="sm" disabled={isConnecting} onClick={doConnect}>
                {isConnecting ? "Redirecting..." : "Connect Stripe Account"}
              </Button>
            </>
          ) : !connectStatus.payoutsEnabled ? (
            <>
              <p className="mb-4 text-[12.5px] text-text-muted">
                Your Stripe account needs a few more details before payouts can go out.
              </p>
              <Button size="sm" disabled={isConnecting} onClick={doConnect}>
                {isConnecting ? "Redirecting..." : "Finish Connecting Stripe"}
              </Button>
            </>
          ) : (
            <p className="text-[12.5px] text-success">
              Your Stripe account is connected and ready to receive payouts.
            </p>
          )}
        </div>
      )}

      <div className={dashCard + " mt-6"}>
        <h3 className={dashHeading}>Change Password</h3>

        <div className="mb-4">
          <label className={formLabel}>Current password</label>
          <input type="password" className={formControl} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </div>

        <div className="mb-4 grid grid-cols-2 gap-4 max-[560px]:grid-cols-1">
          <div>
            <label className={formLabel}>New password</label>
            <input type="password" className={formControl} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </div>
          <div>
            <label className={formLabel}>Confirm new password</label>
            <input type="password" className={formControl} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
        </div>

        {passwordMsg && <p className="mb-4 text-[12.5px] text-text-muted">{passwordMsg}</p>}

        <Button
          disabled={isPasswordPending || !currentPassword || !newPassword}
          onClick={savePassword}
        >
          {isPasswordPending ? "Updating..." : "Update Password"}
        </Button>
      </div>
    </>
  );
}
