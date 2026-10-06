"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent } from "react";

import { AbnField } from "@/components/ui/AbnField";
import { Button, buttonClasses } from "@/components/ui/Button";
import { formControl, formLabel } from "@/components/ui/Form";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { ViewHeader } from "@/components/ui/ViewHeader";


import { ABN_COUNTRY } from "@/lib/platformConfig";
import type { ConnectStatus } from "@/app/(portal)/author-dashboard/payoutActions";
import { updateAvatar, updateProfile } from "./actions";

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

  // Payout accounts live in MYHitch Business; Lens only links there. Inlined at build time.
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL;
  const payoutSetupHref = portalUrl ? `${portalUrl}/onboarding/business` : null;

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

  return (
    <>
      <ViewHeader title="My Profile" subtitle="Manage your account details and tax information." />

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
            <AbnField value={abnVal} onChange={setAbnVal} label="ABN (optional)" />
          )}
        </div>

        {profileMsg && <p className="mb-4 text-[12.5px] text-text-muted">{profileMsg}</p>}

        <Button disabled={isPending} onClick={saveProfile}>
          {isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      {connectStatus && (
        <div className={dashCard + " mt-6"}>
          <h3 className={dashHeading}>Payouts</h3>
          {!connectStatus.configured ? (
            <p className="text-[12.5px] text-text-muted">Payout status is temporarily unavailable — please try again shortly.</p>
          ) : !connectStatus.connected || !connectStatus.payoutsEnabled ? (
            <>
              <p className="mb-4 text-[12.5px] text-text-muted">
                {connectStatus.connected
                  ? "Your payout account needs a few more details before it can receive funds."
                  : "Set up payouts once in MYHitch Business to receive your earnings."}
              </p>
              {payoutSetupHref && (
                <a
                  href={payoutSetupHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonClasses("primary", "sm")}
                >
                  {connectStatus.connected ? "Finish payout setup" : "Set up payouts in MYHitch Business"}
                </a>
              )}
            </>
          ) : (
            <p className="text-[12.5px] text-success">
              Your payout account is active. Payouts and bank details are managed in MYHitch Business.
            </p>
          )}
        </div>
      )}

      <div className={dashCard + " mt-6"}>
        <h3 className={dashHeading}>Password &amp; security</h3>
        <p className="text-[13px] text-text-muted">
          You sign in with your MYHitch account, so your password and sign-in security are managed there, not in Lens.
        </p>
      </div>
    </>
  );
}
