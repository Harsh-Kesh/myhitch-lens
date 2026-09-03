"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/Button";
import { formControl, formLabel } from "@/components/ui/Form";
import { dashCard, dashHeading } from "@/components/ui/DashboardKit";
import { ViewHeader } from "@/components/ui/ViewHeader";

import { ABN_COUNTRY } from "@/lib/platformConfig";
import { changePassword, updateProfile } from "./actions";

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
}: {
  displayName: string;
  email: string;
  username: string;
  bio: string;
  website: string;
  country: string;
  abn: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
        setProfileMsg("Saved.");
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
