import { ExternalLink } from "lucide-react";

import { registryListForEmail } from "~/server/registry";
import { getSessionEmail } from "~/server/auth";

/**
 * Server component rendered at the bottom of the dashboard. Queries the
 * shared registry for the currently signed-in Google email, then fetches a
 * lightweight preview of each remote card. Renders nothing when the user is
 * not signed in or has no cross-project shares.
 */
export async function SharedFromOtherProjects() {
  const email = await getSessionEmail();
  if (!email) return null;

  const entries = await registryListForEmail(email);
  if (entries.length === 0) return null;

  return (
    <section className="mt-10 rounded-2xl border border-violet-100 bg-white/60 p-6 shadow-sm">
      <h2 className="mb-1 text-lg font-bold text-gray-900">
        Shared with me from other projects
      </h2>
      <p className="mb-4 text-xs text-gray-500">
        Cards shared to <code>{email}</code> from sibling Cardx projects.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {entries.map((e) => (
          <a
            key={`${e.projectSlug}-${e.cardShareToken}`}
            href={`${e.projectBaseUrl.replace(/\/$/, "")}/cards/shared/${e.cardShareToken}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-3 transition hover:border-violet-300 hover:shadow-md"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-violet-600">
              <span className="rounded bg-violet-50 px-1.5 py-0.5 font-semibold">
                {e.projectSlug}
              </span>
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-gray-600">
                {e.permission}
              </span>
              <ExternalLink className="ml-auto h-3 w-3 opacity-0 transition group-hover:opacity-100" />
            </div>
            {e.cardImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.cardImageUrl}
                alt={e.cardTitle ?? "Shared card"}
                className="h-24 w-full rounded-lg object-cover"
              />
            ) : (
              <div className="h-24 w-full rounded-lg bg-gradient-to-br from-violet-100 to-rose-100" />
            )}
            <div className="truncate text-sm font-semibold text-gray-900">
              {e.cardTitle ?? "(untitled)"}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
