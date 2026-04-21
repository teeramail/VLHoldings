import { NextResponse } from "next/server";
import { db } from "~/server/db";
import { studyCards } from "~/server/db/schema";
import { sql, and, gte, lte } from "drizzle-orm";
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
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const periodStart = new Date(now.getFullYear(), now.getMonth() - monthsCount + 1, 1);

    const [monthlyStats, categoryStats] = await Promise.all([
      db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${studyCards.createdAt}), 'YYYY-MM')`,
          itemCount: sql<number>`count(*)`,
          completedCount: sql<number>`count(*) filter (where ${studyCards.isCompleted} = true)`,
          totalExpenses: sql<number>`coalesce(sum(${studyCards.estimatedCost}), 0)`,
          completedValue: sql<number>`coalesce(sum(${studyCards.estimatedCost}) filter (where ${studyCards.isCompleted} = true), 0)`,
        })
        .from(studyCards)
        .where(and(gte(studyCards.createdAt, periodStart), lte(studyCards.createdAt, periodEnd)))
        .groupBy(sql`date_trunc('month', ${studyCards.createdAt})`)
        .orderBy(sql`date_trunc('month', ${studyCards.createdAt}) desc`),

      db
        .select({
          month: sql<string>`to_char(date_trunc('month', ${studyCards.createdAt}), 'YYYY-MM')`,
          category: sql<string>`coalesce(${studyCards.category}, 'Uncategorized')`,
          amount: sql<number>`coalesce(sum(${studyCards.estimatedCost}), 0)`,
          count: sql<number>`count(*)`,
        })
        .from(studyCards)
        .where(and(gte(studyCards.createdAt, periodStart), lte(studyCards.createdAt, periodEnd)))
        .groupBy(sql`date_trunc('month', ${studyCards.createdAt})`, sql`coalesce(${studyCards.category}, 'Uncategorized')`)
        .orderBy(sql`date_trunc('month', ${studyCards.createdAt}) desc`),
    ]);

    const categoryByMonth = new Map<string, { name: string; amount: number; count: number }[]>();
    for (const row of categoryStats) {
      const key = row.month;
      const list = categoryByMonth.get(key) ?? [];
      list.push({ name: row.category, amount: Number(row.amount), count: Number(row.count) });
      categoryByMonth.set(key, list);
    }

    const statsMap = new Map<string, typeof monthlyStats[number]>();
    for (const row of monthlyStats) {
      statsMap.set(row.month, row);
    }

    const summaries = [];
    for (let i = 0; i < monthsCount; i++) {
      const targetDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);
      const monthEnd = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0, 23, 59, 59);
      const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;

      const stats = statsMap.get(monthKey);
      const totalExpenses = Number(stats?.totalExpenses ?? 0);
      const completedValue = Number(stats?.completedValue ?? 0);
      const itemCount = Number(stats?.itemCount ?? 0);
      const completedCount = Number(stats?.completedCount ?? 0);

      summaries.push({
        periodType: "monthly" as const,
        periodStart: monthStart.toISOString().split("T")[0],
        periodEnd: monthEnd.toISOString().split("T")[0],
        totalRevenue: completedValue,
        totalExpenses,
        netProfit: completedValue - totalExpenses,
        cashInflow: completedValue,
        cashOutflow: totalExpenses,
        netCashFlow: completedValue - totalExpenses,
        itemCount,
        completedCount,
        expenseCategories: categoryByMonth.get(monthKey) ?? [],
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
