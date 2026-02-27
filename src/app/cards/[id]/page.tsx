import { eq } from "drizzle-orm";
import Image from "next/image";
import { notFound } from "next/navigation";

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

interface Attachment {
  s3Key: string;
  url: string;
  originalName: string;
  mimeType: string;
  fileSize: number;
  subfolder: string;
  kind?: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const cardId = Number(id);
  if (isNaN(cardId)) notFound();

  const rows = await db
    .select()
    .from(studyCards)
    .where(eq(studyCards.id, cardId))
    .limit(1);

  const card = rows[0];
  if (!card) notFound();

  const parsedAttachments: Attachment[] = card.attachments
    ? (JSON.parse(card.attachments) as Attachment[])
    : [];

  const galleryImages = parsedAttachments.filter((a) => a.kind === "card-image");
  if (
    card.imageUrl &&
    !galleryImages.some(
      (img) => img.s3Key === card.imageS3Key || img.url === card.imageUrl,
    )
  ) {
    galleryImages.unshift({
      s3Key: card.imageS3Key ?? card.imageUrl,
      url: card.imageUrl,
      subfolder: "study-cards/images",
      originalName: "Card image",
      mimeType: "image/jpeg",
      fileSize: 0,
      kind: "card-image",
    });
  }

  const fileAttachments = parsedAttachments.filter((a) => a.kind !== "card-image");
  const embedUrl = card.youtubeUrl ? getYoutubeEmbedUrl(card.youtubeUrl) : null;
  const tags = card.tags ? card.tags.split(",").map((t) => t.trim()).filter(Boolean) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-rose-50">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-gray-200/60 bg-white/80 backdrop-blur-lg">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <a href="/" className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900">
              ← Back to cards
            </a>
            <a
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-violet-700"
            >
              Edit this card
            </a>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {/* Image gallery */}
          {galleryImages.length > 0 && (
            <div className="grid gap-2 bg-gray-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {galleryImages.map((img) => (
                <a
                  key={img.s3Key}
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative aspect-video overflow-hidden rounded-lg border border-gray-200 bg-gray-100"
                >
                  <Image
                    src={img.url}
                    alt={img.originalName}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                </a>
              ))}
            </div>
          )}

          {/* YouTube embed */}
          {!galleryImages.length && embedUrl && (
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
          <div className="p-6">
            {/* Title + meta */}
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{card.title}</h1>
                <p className="mt-1 text-sm text-gray-500">
                  {card.createdAt
                    ? new Date(card.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
                    : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {card.category && (
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-sm font-medium text-violet-600">
                    {card.category}
                  </span>
                )}
                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${
                    card.difficulty === "easy"
                      ? "bg-green-100 text-green-700"
                      : card.difficulty === "hard"
                      ? "bg-red-100 text-red-700"
                      : "bg-amber-100 text-amber-700"
                  }`}
                >
                  {card.difficulty ?? "medium"}
                </span>
                {card.isCompleted && (
                  <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-700">
                    Completed
                  </span>
                )}
              </div>
            </div>

            {/* YouTube embed (when gallery images also present) */}
            {galleryImages.length > 0 && embedUrl && (
              <div className="mb-5">
                <p className="mb-2 text-sm font-medium text-gray-700">Video</p>
                <div className="aspect-video overflow-hidden rounded-lg border border-gray-200">
                  <iframe src={embedUrl} title={card.title} className="h-full w-full" allowFullScreen />
                </div>
              </div>
            )}

            {/* Reference link */}
            {card.referenceUrl && (
              <div className="mb-5">
                <p className="mb-2 text-sm font-medium text-gray-700">Reference Link</p>
                <a
                  href={card.referenceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-medium text-violet-700 hover:bg-violet-100"
                >
                  ↗ Open link
                </a>
              </div>
            )}

            {/* Description */}
            <div
              className="prose prose-sm max-w-none whitespace-pre-wrap text-gray-700"
              dangerouslySetInnerHTML={{ __html: card.description }}
            />

            {/* Cost + Invest date */}
            <div className="mt-5 flex flex-wrap gap-4 text-sm">
              {card.estimatedCost && card.estimatedCost > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Estimated Cost:</span>
                  <span className="rounded-full bg-green-100 px-3 py-1 font-medium text-green-700">
                    ${card.estimatedCost.toLocaleString()}
                  </span>
                </div>
              ) : null}
              {card.investDate && (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Invest Date:</span>
                  <span className="rounded-full bg-blue-100 px-3 py-1 font-medium text-blue-700">
                    {new Date(card.investDate).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
              {card.rating && card.rating > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-700">Rating:</span>
                  <span className="text-amber-500">{"★".repeat(card.rating)}{"☆".repeat(5 - card.rating)}</span>
                </div>
              ) : null}
            </div>

            {/* Tags */}
            {tags.length > 0 && (
              <div className="mt-5 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {/* Notes */}
            {card.notes && (
              <div className="mt-5 rounded-lg bg-amber-50 p-4 text-sm text-amber-800">
                <p className="mb-1 font-medium">Notes</p>
                {card.notes}
              </div>
            )}

            {/* File attachments */}
            {fileAttachments.length > 0 && (
              <div className="mt-5 rounded-lg border border-gray-200 p-4">
                <p className="mb-3 text-sm font-medium text-gray-700">Attachments</p>
                <div className="space-y-2">
                  {fileAttachments.map((att) => (
                    <a
                      key={att.s3Key}
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2 text-sm hover:bg-violet-50"
                    >
                      <span className="flex-1 truncate font-medium text-gray-800">{att.originalName}</span>
                      <span className="text-xs text-gray-400">{formatFileSize(att.fileSize)}</span>
                      <span className="text-gray-400">↓</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Edit button bottom */}
            <div className="mt-8 border-t border-gray-100 pt-6">
              <a
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"
              >
                Edit this card in Dashboard
              </a>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
