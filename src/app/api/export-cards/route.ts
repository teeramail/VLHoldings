import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { studyCards } from "~/server/db/schema";
import { env } from "~/env";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = request.headers.get("x-cardx-api-key") ?? searchParams.get("apiKey");

  if (!env.CARDX_EXPORT_API_KEY || apiKey !== env.CARDX_EXPORT_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cards = await db.select().from(studyCards);
    return NextResponse.json({
      appName: "Anusara",
      cards: cards.map(card => ({
        title: card.title,
        description: card.description,
        referenceUrl: card.referenceUrl,
        youtubeUrl: card.youtubeUrl,
        imageUrl: card.imageUrl,
        imageS3Key: card.imageS3Key,
        attachments: card.attachments,
        groupCalendar: card.groupCalendar,
        expenses: card.expenses,
        category: card.category,
        difficulty: card.difficulty,
        tags: card.tags,
        isCompleted: card.isCompleted,
        rating: card.rating,
        notes: card.notes,
        estimatedCost: card.estimatedCost,
        investDate: card.investDate,
      })),
    });
  } catch (error) {
    console.error("Failed to export cards:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
