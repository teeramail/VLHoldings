import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { studyCards } from "~/server/db/schema";
import { sql, eq, and, gte, lte } from "drizzle-orm";
import { env } from "~/env";

/**
 * Finance Summary API for President App
 *
 * This read-only endpoint exposes aggregated financial data
 * from VLHoldings for the executive dashboard.
 *
 * Authentication: Bearer token via PRESIDENT_API_KEY
 *
 * Query params:
 *   - periodType: "monthly" | "quarterly" | "yearly" (default: "monthly")
 *   - year: number (default: current year)
 *   - month: number 1-12 (for monthly, default: current month)
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

  // --- Parse query params ---
  const url = new URL(request.url);
  const periodType = url.searchParams.get("periodType") ?? "monthly";
  const now = new Date();
  const year = parseInt(url.searchParams.get("year") ?? String(now.getFullYear()));
  const month = parseInt(url.searchParams.get("month") ?? String(now.getMonth() + 1));

  // --- Calculate period boundaries ---
  let periodStart: Date;
  let periodEnd: Date;

  if (periodType === "yearly") {
    periodStart = new Date(year, 0, 1);
    periodEnd = new Date(year, 11, 31, 23, 59, 59);
  } else if (periodType === "quarterly") {
    const quarter = Math.ceil(month / 3);
    periodStart = new Date(year, (quarter - 1) * 3, 1);
    periodEnd = new Date(year, quarter * 3, 0, 23, 59, 59);
  } else {
    periodStart = new Date(year, month - 1, 1);
    periodEnd = new Date(year, month, 0, 23, 59, 59);
  }

  try {
    // --- Aggregate investment/expense data from studyCards ---
    // Cards created in this period represent investment activity
    const periodCards = await db
      .select()
      .from(studyCards)
      .where(
        and(
          gte(studyCards.createdAt, periodStart),
          lte(studyCards.createdAt, periodEnd)
        )
      );

    // Total investment (estimated costs) = treated as expenses/outflow
    const totalExpenses = periodCards.reduce(
      (sum, card) => sum + (card.estimatedCost ?? 0),
      0
    );

    // Completed items in this period can represent realized value
    const completedCards = periodCards.filter((c) => c.isCompleted);
    const completedValue = completedCards.reduce(
      (sum, card) => sum + (card.estimatedCost ?? 0),
      0
    );

    // For a holdings/investment tracker, "revenue" = completed investment value
    // "expenses" = total new investment commitments
    const totalRevenue = completedValue;
    const netProfit = totalRevenue - totalExpenses;

    // Cash flow: outflow = new investments, inflow = completed/realized
    const cashInflow = completedValue;
    const cashOutflow = totalExpenses;
    const netCashFlow = cashInflow - cashOutflow;

    // --- Category breakdown ---
    const categoryMap = new Map<string, { amount: number; count: number }>();
    for (const card of periodCards) {
      const cat = card.category ?? "Uncategorized";
      const existing = categoryMap.get(cat) ?? { amount: 0, count: 0 };
      existing.amount += card.estimatedCost ?? 0;
      existing.count += 1;
      categoryMap.set(cat, existing);
    }

    const expenseCategories = Array.from(categoryMap.entries()).map(
      ([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
      })
    );

    // Revenue categories (completed items by category)
    const revCategoryMap = new Map<string, { amount: number; count: number }>();
    for (const card of completedCards) {
      const cat = card.category ?? "Uncategorized";
      const existing = revCategoryMap.get(cat) ?? { amount: 0, count: 0 };
      existing.amount += card.estimatedCost ?? 0;
      existing.count += 1;
      revCategoryMap.set(cat, existing);
    }

    const revenueCategories = Array.from(revCategoryMap.entries()).map(
      ([name, data]) => ({
        name,
        amount: data.amount,
        count: data.count,
      })
    );

    // --- Overall stats ---
    const allCardsResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(studyCards);
    const totalItems = Number(allCardsResult[0]?.count ?? 0);

    const allCompletedResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(studyCards)
      .where(eq(studyCards.isCompleted, true));
    const totalCompleted = Number(allCompletedResult[0]?.count ?? 0);

    // --- Response in President App standard format ---
    return NextResponse.json({
      projectCode: "VLHOLDINGS",
      projectName: "VL Holdings",
      periodType,
      periodStart: periodStart.toISOString().split("T")[0],
      periodEnd: periodEnd.toISOString().split("T")[0],
      currency: "THB",

      totalRevenue,
      totalExpenses,
      netProfit,
      cashInflow,
      cashOutflow,
      netCashFlow,

      revenueCategories,
      expenseCategories,

      metadata: {
        totalItems,
        totalCompleted,
        periodItemCount: periodCards.length,
        periodCompletedCount: completedCards.length,
        completionRate:
          totalItems > 0
            ? Math.round((totalCompleted / totalItems) * 100)
            : 0,
      },

      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Finance API] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
