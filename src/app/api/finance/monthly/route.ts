import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { studyCards } from "~/server/db/schema";
import { sql, and, gte, lte, eq } from "drizzle-orm";
import { env } from "~/env";

/**
 * Monthly Finance History API for President App
 *
 * Returns the last N months of financial summaries in a single response.
 * This is used by the President App to bulk-sync historical data.
 *
 * Query params:
 *   - months: number of months to return (default: 12, max: 24)
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
  const monthsCount = Math.min(
    parseInt(url.searchParams.get("months") ?? "12"),
    24
  );

  try {
    const now = new Date();
    const summaries = [];

    for (let i = 0; i < monthsCount; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const periodStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const periodEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);

      const periodCards = await db
        .select()
        .from(studyCards)
        .where(
          and(
            gte(studyCards.createdAt, periodStart),
            lte(studyCards.createdAt, periodEnd)
          )
        );

      const totalExpenses = periodCards.reduce(
        (sum: number, card) => sum + (card.estimatedCost ?? 0),
        0
      );

      const completedCards = periodCards.filter((c) => c.isCompleted);
      const completedValue = completedCards.reduce(
        (sum: number, card) => sum + (card.estimatedCost ?? 0),
        0
      );

      const totalRevenue = completedValue;

      // Category breakdown
      const categoryMap = new Map<string, { amount: number; count: number }>();
      for (const card of periodCards) {
        const cat = card.category ?? "Uncategorized";
        const existing = categoryMap.get(cat) ?? { amount: 0, count: 0 };
        existing.amount += card.estimatedCost ?? 0;
        existing.count += 1;
        categoryMap.set(cat, existing);
      }

      summaries.push({
        periodType: "monthly" as const,
        periodStart: periodStart.toISOString().split("T")[0],
        periodEnd: periodEnd.toISOString().split("T")[0],
        totalRevenue,
        totalExpenses,
        netProfit: totalRevenue - totalExpenses,
        cashInflow: completedValue,
        cashOutflow: totalExpenses,
        netCashFlow: completedValue - totalExpenses,
        itemCount: periodCards.length,
        completedCount: completedCards.length,
        expenseCategories: Array.from(categoryMap.entries()).map(
          ([name, data]) => ({ name, amount: data.amount, count: data.count })
        ),
      });
    }

    return NextResponse.json({
      projectCode: "VLHOLDINGS",
      projectName: "VL Holdings",
      currency: "THB",
      summaries,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Finance Monthly API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
