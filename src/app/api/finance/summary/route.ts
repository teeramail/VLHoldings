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
  const periodType = url.searchParams.get("periodType") ?? "monthly";
  const now = new Date();
  const year = parseInt(url.searchParams.get("year") ?? String(now.getFullYear()));
  const month = parseInt(url.searchParams.get("month") ?? String(now.getMonth() + 1));

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

  const periodCondition = and(
    gte(studyCards.createdAt, periodStart),
    lte(studyCards.createdAt, periodEnd)
  );

  try {
    const [periodAndOverallRows, expenseCategories, revenueCategories] = await Promise.all([
      db
        .select({
          totalExpenses: sql<number>`coalesce(sum(${studyCards.estimatedCost}), 0)`,
          completedValue: sql<number>`coalesce(sum(case when ${studyCards.isCompleted} = true then ${studyCards.estimatedCost} else 0 end), 0)`,
          periodItemCount: sql<number>`count(*)`,
          periodCompletedCount: sql<number>`count(*) filter (where ${studyCards.isCompleted} = true)`,
          totalItems: sql<number>`(select count(*) from ${studyCards})`,
          totalCompleted: sql<number>`(select count(*) from ${studyCards} where ${studyCards.isCompleted} = true)`,
        })
        .from(studyCards)
        .where(periodCondition),

      db
        .select({
          name: sql<string>`coalesce(${studyCards.category}, 'Uncategorized')`,
          amount: sql<number>`sum(${studyCards.estimatedCost})`,
          count: sql<number>`count(*)`,
        })
        .from(studyCards)
        .where(periodCondition)
        .groupBy(sql`coalesce(${studyCards.category}, 'Uncategorized')`),

      db
        .select({
          name: sql<string>`coalesce(${studyCards.category}, 'Uncategorized')`,
          amount: sql<number>`sum(${studyCards.estimatedCost})`,
          count: sql<number>`count(*)`,
        })
        .from(studyCards)
        .where(and(periodCondition, eq(studyCards.isCompleted, true)))
        .groupBy(sql`coalesce(${studyCards.category}, 'Uncategorized')`),
    ]);

    const periodStats = periodAndOverallRows[0];
    const totalExpenses = Number(periodStats?.totalExpenses ?? 0);
    const completedValue = Number(periodStats?.completedValue ?? 0);
    const periodItemCount = Number(periodStats?.periodItemCount ?? 0);
    const periodCompletedCount = Number(periodStats?.periodCompletedCount ?? 0);
    const totalItems = Number(periodStats?.totalItems ?? 0);
    const totalCompleted = Number(periodStats?.totalCompleted ?? 0);

    const totalRevenue = completedValue;
    const netProfit = totalRevenue - totalExpenses;
    const cashInflow = completedValue;
    const cashOutflow = totalExpenses;
    const netCashFlow = cashInflow - cashOutflow;

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
        periodItemCount,
        periodCompletedCount,
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
