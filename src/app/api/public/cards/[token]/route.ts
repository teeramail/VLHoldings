import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";

import { db } from "~/server/db";
import { studyCardShares, studyCards } from "~/server/db/schema";

/**
 * Public read-only endpoint used for cross-project card sharing.
 *
 *   GET /api/public/cards/:token
 *     - If card.visibility === 'public' -> returns the card to anyone.
 *     - Else returns 401 unless the request carries `x-share-email` matching
 *       a row in `study_card_share`.
 *
 * CORS is wide open for GET so sibling Cardx projects can fetch server-side
 * or client-side.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-share-email",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS() {
  return new NextResponse(null, { headers: corsHeaders });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!token) {
    return NextResponse.json({ error: "Missing token" }, { status: 400, headers: corsHeaders });
  }

  const [card] = await db
    .select()
    .from(studyCards)
    .where(eq(studyCards.shareToken, token))
    .limit(1);

  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404, headers: corsHeaders });
  }

  let permission: "view" | "edit" = "view";

  if (card.visibility !== "public") {
    const shareEmail = req.headers.get("x-share-email")?.toLowerCase();
    if (!shareEmail) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }
    const [grant] = await db
      .select({ permission: studyCardShares.permission })
      .from(studyCardShares)
      .where(
        and(
          eq(studyCardShares.cardId, card.id),
          eq(studyCardShares.email, shareEmail),
        ),
      )
      .limit(1);
    if (!grant) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403, headers: corsHeaders });
    }
    permission = grant.permission as "view" | "edit";
  }

  return NextResponse.json(
    {
      id: card.id,
      title: card.title,
      description: card.description,
      referenceUrl: card.referenceUrl,
      youtubeUrl: card.youtubeUrl,
      imageUrl: card.imageUrl,
      category: card.category,
      difficulty: card.difficulty,
      tags: card.tags,
      rating: card.rating,
      isCompleted: card.isCompleted,
      investDate: card.investDate,
      estimatedCost: card.estimatedCost,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      permission,
      visibility: card.visibility,
    },
    { headers: corsHeaders },
  );
}
