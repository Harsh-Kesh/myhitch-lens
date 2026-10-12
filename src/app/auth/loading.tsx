import Image from "next/image";

/** Shown while any /auth route resolves (e.g. the post-SSO landing redirect). */
export default function AuthLoading() {
  return (
    <div className="flex min-h-[100svh] items-center justify-center bg-bg-secondary p-6 max-[480px]:p-4" role="status" aria-live="polite">
      <div className="flex w-full max-w-[440px] flex-col items-center gap-5 rounded-2xl border border-line bg-bg-primary p-8 text-center shadow-card">
        <Image src="/images/logo.png" alt="MYHitch Lens" width={260} height={147} priority className="h-14 w-auto object-contain" />
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-line border-t-primary motion-reduce:animate-none" />
        <p className="text-[13px] text-text-muted">Signing you in…</p>
      </div>
    </div>
  );
}
