"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { formControlSm, formLabel } from "@/components/ui/Form";
import {
  pushNotification,
  ROLE_HOME,
  ROLE_NAMES,
  setUserName,
  setUserRole,
} from "@/lib/lensStore";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/lib/types";

type AuthTab = "signin" | "signup";

const PRESETS: {
  role: UserRole;
  label: string;
  username: string;
  password: string;
  dotColor: string;
}[] = [
  {
    role: "reader",
    label: "Sign in as Markus Green (Reader)",
    username: "markus_green",
    password: "password99",
    dotColor: "var(--primary-color)",
  },
  {
    role: "author",
    label: "Sign in as Dr. Sarah Chen (Author)",
    username: "sarah_chen",
    password: "password123",
    dotColor: "#2da4df",
  },
  {
    role: "editor",
    label: "Sign in as Chief Editor Vance (Editor)",
    username: "editor_vance",
    password: "boss_editor",
    dotColor: "#e28743",
  },
];

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "reader", label: "Reader Profile" },
  { value: "author", label: "Author (Premium)" },
  { value: "editor", label: "Editor (Compliance Admin)" },
];

/** `.ai-pill-btn`, reused here for the fast-login shortcuts. */
const presetButton =
  "flex cursor-pointer items-center gap-2 rounded-lg border border-line bg-bg-primary px-3.5 py-2.5 text-left font-body text-[12.5px] font-[550] text-text-main transition-all duration-200 hover:translate-x-1 hover:border-primary hover:bg-surface-hover";

/** `.toolbar-btn` in its tab role. */
const tabButton =
  "cursor-pointer rounded border-none bg-transparent px-4 py-1.5 text-[13px] transition-all duration-200";

function parseRole(value: string | null): UserRole | null {
  return value === "reader" || value === "author" || value === "editor" ? value : null;
}

function AuthCard() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("sarah_chen");
  const [password, setPassword] = useState("password123");

  /**
   * `?mode=` and `?role=` seed the form, exactly as the original
   * DOMContentLoaded handler did. A `null` override means "still following the
   * URL", so arriving from a different link updates the form.
   */
  const [pickedTab, setPickedTab] = useState<AuthTab | null>(null);
  const [pickedRole, setPickedRole] = useState<UserRole | null>(null);

  const tab = pickedTab ?? (searchParams.get("mode") === "signup" ? "signup" : "signin");
  const role = pickedRole ?? parseRole(searchParams.get("role")) ?? "author";

  /** Shared by the form submit and the one-click preset buttons. */
  function authenticate(nextRole: UserRole, nextUsername: string) {
    setUserRole(nextRole);
    const displayName = ROLE_NAMES[nextRole] ?? nextUsername;
    setUserName(displayName);

    pushNotification(
      `Successfully authenticated: ${nextUsername} in ${nextRole} mode.`,
    );

    alert(
      `Vetting Complete!\nWelcome, ${displayName} (${nextRole.toUpperCase()} profile).`,
    );
    router.push(ROLE_HOME[nextRole]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    authenticate(role, username.trim());
  }

  function selectPreset(preset: (typeof PRESETS)[number]) {
    setUsername(preset.username);
    setPassword(preset.password);
    setPickedRole(preset.role);
    authenticate(preset.role, preset.username);
  }

  return (
    /* `.modal-wrapper` reused as a standalone auth card */
    <div className="static flex w-full max-w-[440px] flex-col overflow-y-auto rounded-2xl border border-line bg-bg-primary shadow-card">
      <div className="border-b border-line p-5 max-[480px]:p-4">
        <Link
          href="/"
          className="inline-flex w-full cursor-pointer items-center justify-center"
        >
          <Image
            src="/images/logo.jpeg"
            alt="MYHitch Lens"
            width={100}
            height={100}
            priority
            className="h-25 max-h-25 w-auto rounded object-contain align-middle max-[480px]:h-18 max-[480px]:max-h-18"
          />
        </Link>
      </div>

      <div className="p-6 max-[480px]:p-4">
        <div className="mb-5 flex justify-around border-b border-line pb-2.5">
          <button
            type="button"
            onClick={() => setPickedTab("signin")}
            className={cn(
              tabButton,
              tab === "signin"
                ? "border-b-2 border-primary font-bold text-primary"
                : "font-medium text-text-muted hover:bg-surface-hover hover:text-text-main",
            )}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setPickedTab("signup")}
            className={cn(
              tabButton,
              tab === "signup"
                ? "border-b-2 border-primary font-bold text-primary"
                : "font-medium text-text-muted hover:bg-surface-hover hover:text-text-main",
            )}
          >
            Sign Up
          </button>
        </div>

        {/* Fast preset selectors */}
        {tab === "signin" && (
          <div>
            <p className="mb-2 text-[11px] font-bold text-text-muted uppercase">
              Fast Vetting Simulators:
            </p>
            <div className="mb-5 flex flex-col gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.role}
                  type="button"
                  className={presetButton}
                  onClick={() => selectPreset(preset)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="size-3 shrink-0"
                    fill={preset.dotColor}
                    stroke="none"
                  >
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="relative mb-4 text-center text-xs text-text-muted">
              <span className="relative z-1 bg-bg-primary px-2">
                or enter credentials
              </span>
              <div className="absolute top-1/2 right-0 left-0 z-0 h-px bg-line" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label htmlFor="authUsername" className={formLabel}>
              Username / ID
            </label>
            <input
              id="authUsername"
              type="text"
              className={formControlSm}
              placeholder="Enter username..."
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="authPassword" className={formLabel}>
              Password
            </label>
            <input
              id="authPassword"
              type="password"
              className={formControlSm}
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </div>

          {tab === "signup" && (
            <div>
              <label htmlFor="authRole" className={formLabel}>
                Select Role Profile
              </label>
              <select
                id="authRole"
                className={formControlSm}
                value={role}
                onChange={(event) => setPickedRole(event.target.value as UserRole)}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button type="submit" className="mt-2 w-full">
            {tab === "signin" ? "Sign In Vetted Profile" : "Create Vetted Account"}
          </Button>
        </form>

        <div className="mt-5 text-center text-xs">
          <button
            type="button"
            className="cursor-pointer bg-transparent px-2 py-1.5 text-primary"
            onClick={() =>
              alert("Password reset link sent to registered email! (Simulated)")
            }
          >
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-bg-secondary p-6 max-[480px]:p-4">
      <Suspense fallback={null}>
        <AuthCard />
      </Suspense>
    </div>
  );
}
