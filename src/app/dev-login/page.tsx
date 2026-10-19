import { notFound } from "next/navigation";

import { signIn } from "@/auth";

/**
 * Local-testing sign-in (see `dev-login` in src/auth.ts). 404s everywhere except
 * `next dev` with DEV_LOGIN_EMAIL set, so it doesn't exist in production.
 */
export default function DevLoginPage() {
  const email = process.env.NODE_ENV === "development" ? process.env.DEV_LOGIN_EMAIL?.trim() : undefined;
  if (!email) notFound();

  async function devSignIn() {
    "use server";
    if (process.env.NODE_ENV !== "development" || !process.env.DEV_LOGIN_EMAIL) notFound();
    await signIn("dev-login", { redirectTo: "/author-dashboard" });
  }

  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-bg-secondary p-6">
      <form
        action={devSignIn}
        className="flex w-full max-w-[420px] flex-col items-center gap-4 rounded-2xl border border-line bg-bg-primary p-8 text-center shadow-card"
      >
        <h1 className="font-heading text-lg font-bold text-text-main">Local dev sign-in</h1>
        <p className="text-[13px] text-text-muted">
          Signs you in as <strong className="text-text-main">{email}</strong> without the MYHitch portal. Only available
          while running <code>npm run dev</code>.
        </p>
        <button
          type="submit"
          className="cursor-pointer rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-text-inverse hover:bg-primary-hover"
        >
          Sign in locally
        </button>
      </form>
    </div>
  );
}
