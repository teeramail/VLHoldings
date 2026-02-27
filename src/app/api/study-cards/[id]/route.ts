import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { studyCards } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { env } from "~/env";

/**
 * Single Study Card detail API for President App (read-only)
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  // --- API Key Authentication ---
  const apiKey = env.PRESIDENT_API_KEY;
  if (apiKey) {
    const authHeader = request.headers.get("authorization");
    const providedKey =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (providedKey !== apiKey) {
      return NextResponse.json(
        { error: "Unauthorized. Invalid or missing API key." },
        { status: 401 }
      );
    }
  }

  try {
    const { id } = await params;
    const cardId = parseInt(id);

    if (isNaN(cardId)) {
      return NextResponse.json({ error: "Invalid card ID" }, { status: 400 });
    }

    const card = await db
      .select()
      .from(studyCards)
      .where(eq(studyCards.id, cardId))
      .limit(1);

    if (!card[0]) {
      return NextResponse.json({ error: "Card not found" }, { status: 404 });
    }

    return NextResponse.json({ card: card[0] });
  } catch (error) {
    console.error("[Study Card Detail API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
