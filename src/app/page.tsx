import { desc } from "drizzle-orm";
import Image from "next/image";

import { db } from "~/server/db";
import { studyCards } from "~/server/db/schema";

export const dynamic = "force-dynamic";

function getYoutubeEmbedUrl(url: string) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "youtube.com" || host === "m.youtube.com") {
      if (parsed.pathname === "/watch") {
        const id = parsed.searchParams.get("v");
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/")) {
        const id = parsed.pathname.split("/").filter(Boolean)[1];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
    }
    return null;
  } catch {
    return null;
  }
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
};

export default async function Home() {
  const cards = await db
    .select()
    .from(studyCards)
    .orderBy(desc(studyCards.createdAt));

  const renderedAt = new Date().toLocaleString();

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-rose-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-rose-500 shadow-lg shadow-violet-200">
                <span className="text-lg font-bold text-white">V</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">VLHoldings</h1>
                <p className="text-xs text-gray-500">Study Cards for your kid</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <p className="hidden text-xs text-gray-400 sm:block">Snapshot: {renderedAt}</p>
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
              >
                + New Card
              </a>
              <form action="/" method="get">
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
                >
                  ↻ Refresh
                </button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900">Study Cards</h2>
          <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-medium text-violet-700">
            {cards.length} cards
          </span>
        </div>

        {cards.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-300 py-24">
            <p className="text-lg font-medium text-gray-500">No study cards yet</p>
            <p className="text-sm text-gray-400">Add cards via the dashboard, then refresh.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((card) => {
              const embedUrl = card.youtubeUrl ? getYoutubeEmbedUrl(card.youtubeUrl) : null;
              const difficultyClass =
                DIFFICULTY_COLORS[card.difficulty ?? "medium"] ?? DIFFICULTY_COLORS.medium;
              const tags = card.tags
                ? card.tags.split(",").map((t) => t.trim()).filter(Boolean)
                : [];

              return (
                <a
                  key={card.id}
                  href={`/cards/${card.id}`}
                  className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md hover:border-violet-300 cursor-pointer"
                >
                  {/* Card image */}
                  {card.imageUrl && (
                    <div className="relative aspect-video w-full overflow-hidden bg-gray-100">
                      <Image
                        src={card.imageUrl}
                        alt={card.title}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}

                  {/* YouTube embed */}
                  {!card.imageUrl && embedUrl && (
                    <div className="aspect-video w-full overflow-hidden bg-gray-100">
                      <iframe
                        src={embedUrl}
                        title={card.title}
                        className="h-full w-full"
                        allowFullScreen
                      />
                    </div>
                  )}

                  {/* Body */}
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    {/* Title + badges */}
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-base font-semibold leading-snug text-gray-900">
                        {card.title}
                      </h3>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${difficultyClass}`}
                      >
                        {card.difficulty ?? "medium"}
                      </span>
                    </div>

                    {/* Category */}
                    {card.category && (
                      <span className="w-fit rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-600">
                        {card.category}
                      </span>
                    )}

                    {/* Description */}
                    <p className="line-clamp-3 text-sm text-gray-600">
                      {card.description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}
                    </p>

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tags.slice(0, 5).map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Footer */}
                    <div className="mt-auto flex items-center justify-between pt-2 text-xs text-gray-400">
                      <span>
                        {card.createdAt
                          ? new Date(card.createdAt).toLocaleDateString()
                          : ""}
                      </span>
                      <div className="flex items-center gap-2">
                        {card.isCompleted && (
                          <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Done
                          </span>
                        )}
                        {card.estimatedCost && card.estimatedCost > 0 ? (
                          <span className="font-medium text-gray-600">
                            ${card.estimatedCost.toLocaleString()}
                          </span>
                        ) : null}
                        {card.rating && card.rating > 0 ? (
                          <span className="text-amber-500">{"★".repeat(card.rating)}</span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </a>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
