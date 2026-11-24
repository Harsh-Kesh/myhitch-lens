import Link from "next/link";

import { listIssues } from "@/lib/magazineIssues";

export const metadata = { title: "Magazine issues | MYHitch Lens" };

/** Every released MYHitch Lens magazine issue, newest first, as a shelf of covers. */
export default async function IssuesPage() {
  const issues = await listIssues();
  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <h1 className="text-2xl font-bold">MYHitch Lens Magazine</h1>
      <p className="mt-1 text-sm opacity-70">Every issue, designed by the MYHitch team from the stories published on Lens.</p>
      {!issues.length ? (
        <p className="mt-10 rounded-xl border border-dashed p-10 text-center text-sm opacity-70">The first designed issue is on its way.</p>
      ) : (
        <ul className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-4">
          {issues.map((i) => (
            <li key={i.number}>
              <Link href={`/issues/${i.number}`} className="group block">
                <span className="block aspect-[210/297] overflow-hidden rounded-md bg-neutral-200 shadow-md ring-1 ring-black/5 transition group-hover:-translate-y-1 group-hover:shadow-xl">
                  {i.cover && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.cover} alt={`Cover of ${i.title}`} className="h-full w-full object-cover" loading="lazy" />
                  )}
                </span>
                <span className="mt-2 block text-sm font-semibold">{i.title}</span>
                <span className="block text-xs opacity-60">
                  {new Date(`${i.releaseOn}T00:00:00Z`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })} · {i.pages} pages
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
