import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { studyCards } from "~/server/db/schema";
import { desc, eq, and, like, sql } from "drizzle-orm";
import { env } from "~/env";

/**
 * Read-only Study Cards API for President App
 *
 * Returns study cards data for the executive dashboard.
 * Authentication: Bearer token via PRESIDENT_API_KEY
 *
 * Query params:
 *   - category: filter by category
 *   - limit: max number of cards (default: 50)
 *   - search: search in title/description
 */
export async function GET(request: Request) {
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

  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  const search = url.searchParams.get("search");
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50"), 100);

  try {
    const conditions = [];

    if (category) {
      conditions.push(eq(studyCards.category, category));
    }

    if (search) {
      conditions.push(
        sql`(${studyCards.title} ILIKE ${`%${search}%`} OR ${studyCards.description} ILIKE ${`%${search}%`})`
      );
    }

    const cards = await db
      .select()
      .from(studyCards)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(studyCards.createdAt))
      .limit(limit);

    // Get categories list
    const categoriesResult = await db
      .select({ category: studyCards.category })
      .from(studyCards)
      .where(sql`${studyCards.category} IS NOT NULL`)
      .groupBy(studyCards.category)
      .orderBy(studyCards.category);

    const categories = categoriesResult
      .map((r) => r.category)
      .filter(Boolean);

    // Get stats
    const totalResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(studyCards);

    return NextResponse.json({
      cards,
      categories,
      total: Number(totalResult[0]?.count ?? 0),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Study Cards API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
