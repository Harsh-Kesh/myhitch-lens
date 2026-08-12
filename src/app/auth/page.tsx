"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, useTransition, type FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { formControl, formLabel } from "@/components/ui/Form";
import { loginUser, registerUser } from "@/app/auth/actions";
import { cn } from "@/lib/cn";
import type { UserRole } from "@/lib/types";

type AuthTab = "signin" | "signup";

const PRESETS: { role: UserRole; label: string; username: string; password: string; dotColor: string }[] = [
  { role: "reader", label: "Sign in as Markus Green (Reader)", username: "markus_green", password: "password99", dotColor: "var(--primary-color)" },
  { role: "author", label: "Sign in as Dr. Sarah Chen (Author)", username: "sarah_chen", password: "password123", dotColor: "#2da4df" },
  { role: "editor", label: "Sign in as Chief Editor Vance (Editor)", username: "editor_vance", password: "boss_editor", dotColor: "#e28743" },
];

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "reader", label: "Reader Profile" },
  { value: "author", label: "Author (Premium)" },
  { value: "editor", label: "Editor (Compliance Admin)" },
];

const presetButton =
  "flex cursor-pointer items-center gap-2.5 rounded-lg border border-line bg-bg-primary px-3.5 py-2.5 text-left font-body text-[13px] font-medium text-text-main transition-all duration-200 hover:border-primary hover:bg-surface-hover disabled:opacity-50";

/** Segmented-control tab. */
const tabButton =
  "flex-1 cursor-pointer rounded-md border-none px-4 py-2 text-[13.5px] font-semibold transition-all duration-200";

function parseRole(value: string | null): UserRole | null {
  return value === "reader" || value === "author" || value === "editor" ? value : null;
}

function AuthCard() {
  const searchParams = useSearchParams();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [pickedTab, setPickedTab] = useState<AuthTab | null>(null);
  const [pickedRole, setPickedRole] = useState<UserRole | null>(null);

  const tab = pickedTab ?? (searchParams.get("mode") === "signup" ? "signup" : "signin");
  const role = pickedRole ?? parseRole(searchParams.get("role")) ?? "reader";

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result =
        tab === "signup"
          ? await registerUser({ username, email, password, role })
          : await loginUser({ username, password });
      // A successful auth redirects server-side; only errors return here.
      if (result?.error) setError(result.error);
    });
  }

  function runPreset(preset: (typeof PRESETS)[number]) {
    setError(null);
    setUsername(preset.username);
    setPassword(preset.password);
    startTransition(async () => {
      const result = await loginUser({
        username: preset.username,
        password: preset.password,
      });
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="static flex w-full max-w-[440px] flex-col overflow-y-auto rounded-2xl border border-line bg-bg-primary shadow-card">
      <div className="border-b border-line p-5 max-[480px]:p-4">
        <Link href="/" className="inline-flex w-full cursor-pointer items-center justify-center">
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

      <div className="p-7 max-[480px]:p-5">
        {/* Heading */}
        <div className="mb-5 text-center">
          <h1 className="font-heading text-[22px] font-bold text-text-main">
            {tab === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-1 text-[13px] text-text-muted">
            {tab === "signin"
              ? "Sign in to your vetted MYHitch Lens account."
              : "Join as a reader, author, or editor."}
          </p>
        </div>

        {/* Segmented tab control */}
        <div className="mb-6 flex gap-1 rounded-lg border border-line bg-bg-tertiary p-1">
          <button
            type="button"
            onClick={() => { setPickedTab("signin"); setError(null); }}
            className={cn(tabButton, tab === "signin" ? "bg-primary text-text-inverse shadow-sm" : "bg-transparent text-text-muted hover:text-text-main")}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setPickedTab("signup"); setError(null); }}
            className={cn(tabButton, tab === "signup" ? "bg-primary text-text-inverse shadow-sm" : "bg-transparent text-text-muted hover:text-text-main")}
          >
            Sign Up
          </button>
        </div>

        {tab === "signin" && (
          <div>
            <p className="mb-2.5 text-[11px] font-bold tracking-wide text-text-muted uppercase">
              Quick demo sign-in
            </p>
            <div className="mb-5 flex flex-col gap-2">
              {PRESETS.map((preset) => (
                <button key={preset.role} type="button" className={presetButton} disabled={isPending} onClick={() => runPreset(preset)}>
                  <svg viewBox="0 0 24 24" className="size-3 shrink-0" fill={preset.dotColor} stroke="none">
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  {preset.label}
                </button>
              ))}
            </div>
            <div className="relative mb-5 text-center text-xs text-text-muted">
              <span className="relative z-1 bg-bg-primary px-3">or enter your credentials</span>
              <div className="absolute top-1/2 right-0 left-0 z-0 h-px bg-line" />
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="authUsername" className={formLabel}>Username</label>
            <input id="authUsername" type="text" autoComplete="username" className={formControl} placeholder="e.g. sarah_chen" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>

          {tab === "signup" && (
            <div>
              <label htmlFor="authEmail" className={formLabel}>Email address</label>
              <input id="authEmail" type="email" autoComplete="email" className={formControl} placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          )}

          <div>
            <label htmlFor="authPassword" className={formLabel}>Password</label>
            <input id="authPassword" type="password" autoComplete={tab === "signup" ? "new-password" : "current-password"} className={formControl} placeholder={tab === "signup" ? "At least 8 characters" : "••••••••"} value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>

          {tab === "signup" && (
            <div>
              <label htmlFor="authRole" className={formLabel}>I am joining as a</label>
              <select id="authRole" className={formControl} value={role} onChange={(e) => setPickedRole(e.target.value as UserRole)}>
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          )}

          {error && (
            <p className="rounded-md border border-danger/40 bg-danger/8 px-3 py-2 text-xs font-medium text-danger">
              {error}
            </p>
          )}

          <Button type="submit" className="mt-1 w-full" disabled={isPending}>
            {isPending ? "Please wait…" : tab === "signin" ? "Sign In" : "Create Account"}
          </Button>
        </form>

        {tab === "signin" && (
          <div className="mt-5 text-center text-xs">
            <button
              type="button"
              className="cursor-pointer bg-transparent px-2 py-1.5 text-primary hover:underline"
              onClick={() => alert("Password reset link sent to registered email! (Simulated)")}
            >
              Forgot password?
            </button>
          </div>
        )}
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
