import { eq, desc, and, sql } from "drizzle-orm";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { getCardPermissions } from "~/config/card-settings";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { studyCards } from "~/server/db/schema";
import { deleteS3Object } from "~/server/s3";

export const studyCardsRouter = createTRPCRouter({
  getAll: publicProcedure
    .input(
      z.object({
        category: z.string().optional(),
        difficulty: z.string().optional(),
        isCompleted: z.boolean().optional(),
        search: z.string().optional(),
        limit: z.number().min(1).max(100).default(50),
        cursor: z.number().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      const conditions = [];

      if (input.category) {
        conditions.push(eq(studyCards.category, input.category));
      }

      if (input.difficulty) {
        conditions.push(eq(studyCards.difficulty, input.difficulty));
      }

      if (input.isCompleted !== undefined) {
        conditions.push(eq(studyCards.isCompleted, input.isCompleted));
      }

      if (input.search) {
        conditions.push(
          sql`(${studyCards.title} ILIKE ${`%${input.search}%`} OR ${studyCards.description} ILIKE ${`%${input.search}%` })`
        );
      }

      if (input.cursor) {
        conditions.push(sql`${studyCards.id} < ${input.cursor}`);
      }

      const cards = await ctx.db
        .select({
          id: studyCards.id,
          title: studyCards.title,
          category: studyCards.category,
          difficulty: studyCards.difficulty,
          isCompleted: studyCards.isCompleted,
          rating: studyCards.rating,
          imageUrl: studyCards.imageUrl,
          createdAt: studyCards.createdAt,
          investDate: studyCards.investDate,
          estimatedCost: studyCards.estimatedCost,
        })
        .from(studyCards)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(studyCards.createdAt))
        .limit(input.limit + 1);

      let nextCursor: number | undefined;
      if (cards.length > input.limit) {
        const nextCard = cards.pop();
        nextCursor = nextCard?.id;
      }

      return { items: cards, nextCursor };
    }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const card = await ctx.db
        .select()
        .from(studyCards)
        .where(eq(studyCards.id, input.id))
        .limit(1);
      return card[0] ?? null;
    }),

  create: publicProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        description: z.string().optional(),
        referenceUrl: z.string().url().optional(),
        youtubeUrl: z.string().url().optional(),
        imageUrl: z.string().optional(),
        imageS3Key: z.string().optional(),
        attachments: z.string().optional(),
        groupCalendar: z.string().optional(),
        expenses: z.string().optional(),
        category: z.string().max(100).optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
        tags: z.string().optional(),
        notes: z.string().optional(),
        estimatedCost: z.number().min(0).optional(),
        investDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .insert(studyCards)
        .values({
          title: input.title,
          description: input.description ?? "",
          referenceUrl: input.referenceUrl ?? null,
          youtubeUrl: input.youtubeUrl ?? null,
          imageUrl: input.imageUrl ?? null,
          imageS3Key: input.imageS3Key ?? null,
          attachments: input.attachments ?? null,
          groupCalendar: input.groupCalendar ?? null,
          expenses: input.expenses ?? null,
          category: input.category ?? null,
          difficulty: input.difficulty,
          tags: input.tags ?? null,
          notes: input.notes ?? null,
          estimatedCost: input.estimatedCost ?? 0,
          investDate: input.investDate ?? null,
        })
        .returning();
      return result[0];
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number(),
        title: z.string().min(1).max(255).optional(),
        description: z.string().min(1).optional(),
        referenceUrl: z.string().url().optional(),
        youtubeUrl: z.string().url().optional(),
        imageUrl: z.string().optional(),
        imageS3Key: z.string().optional(),
        attachments: z.string().optional(),
        groupCalendar: z.string().optional(),
        expenses: z.string().optional(),
        category: z.string().max(100).optional(),
        difficulty: z.enum(["easy", "medium", "hard"]).optional(),
        tags: z.string().optional(),
        isCompleted: z.boolean().optional(),
        rating: z.number().min(0).max(5).optional(),
        notes: z.string().optional(),
        estimatedCost: z.number().min(0).optional(),
        investDate: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const existingCard = await ctx.db
        .select({ id: studyCards.id, title: studyCards.title, imageS3Key: studyCards.imageS3Key })
        .from(studyCards)
        .where(eq(studyCards.id, id))
        .limit(1);

      const currentCard = existingCard[0];

      if (!currentCard) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Study card not found",
        });
      }

      const permissions = getCardPermissions(currentCard.title);
      const updateKeys = Object.keys(updates);
      const isCalendarOnlyUpdate = updateKeys.length > 0 && updateKeys.every((key) => key === "groupCalendar");
      const isExpenseOnlyUpdate = updateKeys.length > 0 && updateKeys.every((key) => key === "expenses");
      const isAllowedLockedCardUpdate =
        (isCalendarOnlyUpdate && permissions.canAddCalendar) ||
        (isExpenseOnlyUpdate && permissions.canAddExpense);

      if (!permissions.canEditCard && !isAllowedLockedCardUpdate) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This card is locked and cannot be edited",
        });
      }

      if (updates.imageS3Key) {
        const previousImageKey = currentCard.imageS3Key;
        if (previousImageKey && previousImageKey !== updates.imageS3Key) {
          await deleteS3Object(previousImageKey);
        }
      }

      const result = await ctx.db
        .update(studyCards)
        .set(updates)
        .where(eq(studyCards.id, id))
        .returning();
      return result[0];
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const card = await ctx.db
        .select({ id: studyCards.id, title: studyCards.title, imageS3Key: studyCards.imageS3Key })
        .from(studyCards)
        .where(eq(studyCards.id, input.id))
        .limit(1);

      const existingCard = card[0];

      if (!existingCard) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Study card not found",
        });
      }

      if (!getCardPermissions(existingCard.title).canDeleteCard) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This card is locked and cannot be deleted",
        });
      }

      if (existingCard.imageS3Key) {
        await deleteS3Object(existingCard.imageS3Key);
      }

      await ctx.db.delete(studyCards).where(eq(studyCards.id, input.id));
      return { success: true };
    }),

  getCategories: publicProcedure.query(async ({ ctx }) => {
    const result = await ctx.db
      .select({ category: studyCards.category })
      .from(studyCards)
      .where(sql`${studyCards.category} IS NOT NULL`)
      .groupBy(studyCards.category)
      .orderBy(studyCards.category);
    return result.map((r) => r.category).filter(Boolean);
  }),

  deleteAttachmentFile: publicProcedure
    .input(z.object({ s3Key: z.string().min(1) }))
    .mutation(async ({ input }) => {
      await deleteS3Object(input.s3Key);
      return { success: true };
    }),

  getStats: publicProcedure.query(async ({ ctx }) => {
    const [stats] = await ctx.db
      .select({
        total: sql<number>`count(*)`,
        completed: sql<number>`count(*) filter (where ${studyCards.isCompleted} = true)`,
        avgRating: sql<number>`coalesce(avg(${studyCards.rating}) filter (where ${studyCards.rating} > 0), 0)`,
      })
      .from(studyCards);

    return {
      total: Number(stats?.total ?? 0),
      completed: Number(stats?.completed ?? 0),
      avgRating: Number(stats?.avgRating ?? 0).toFixed(1),
    };
  }),
});
