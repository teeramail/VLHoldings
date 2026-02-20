import { eq, desc, and, like, sql } from "drizzle-orm";
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { studyCards } from "~/server/db/schema";
import { generateUploadUrl, getS3Key, getPublicUrl, deleteS3Object } from "~/server/s3";

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
          sql`(${studyCards.title} ILIKE ${`%${input.search}%`} OR ${studyCards.description} ILIKE ${`%${input.search}%`})`
        );
      }

      if (input.cursor) {
        conditions.push(sql`${studyCards.id} < ${input.cursor}`);
      }

      const cards = await ctx.db
        .select()
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
        description: z.string().min(1),
        referenceUrl: z.string().url().optional(),
        youtubeUrl: z.string().url().optional(),
        imageUrl: z.string().optional(),
        imageS3Key: z.string().optional(),
        attachments: z.string().optional(),
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
          description: input.description,
          referenceUrl: input.referenceUrl ?? null,
          youtubeUrl: input.youtubeUrl ?? null,
          imageUrl: input.imageUrl ?? null,
          imageS3Key: input.imageS3Key ?? null,
          attachments: input.attachments ?? null,
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

      if (updates.imageS3Key) {
        const existingCard = await ctx.db
          .select({ imageS3Key: studyCards.imageS3Key })
          .from(studyCards)
          .where(eq(studyCards.id, id))
          .limit(1);

        const previousImageKey = existingCard[0]?.imageS3Key;
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
        .select()
        .from(studyCards)
        .where(eq(studyCards.id, input.id))
        .limit(1);

      if (card[0]?.imageS3Key) {
        await deleteS3Object(card[0].imageS3Key);
      }

      await ctx.db.delete(studyCards).where(eq(studyCards.id, input.id));
      return { success: true };
    }),

  uploadImage: publicProcedure
    .input(
      z.object({
        fileName: z.string(),
        contentType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const timestamp = Date.now();
      const safeName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
      const uniqueName = `${timestamp}_${safeName}`;
      const s3Key = getS3Key("study-cards", uniqueName);
      const uploadUrl = await generateUploadUrl(s3Key, input.contentType);
      const publicUrl = getPublicUrl(s3Key);

      return { uploadUrl, s3Key, publicUrl, fileName: uniqueName };
    }),

  setImage: publicProcedure
    .input(
      z.object({
        id: z.number(),
        s3Key: z.string(),
        imageUrl: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.db
        .update(studyCards)
        .set({
          imageUrl: input.imageUrl,
          imageS3Key: input.s3Key,
        })
        .where(eq(studyCards.id, input.id))
        .returning();
      return result[0];
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

  getStats: publicProcedure.query(async ({ ctx }) => {
    const totalResult = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(studyCards);
    const completedResult = await ctx.db
      .select({ count: sql<number>`count(*)` })
      .from(studyCards)
      .where(eq(studyCards.isCompleted, true));
    const avgRatingResult = await ctx.db
      .select({ avg: sql<number>`avg(${studyCards.rating})` })
      .from(studyCards)
      .where(sql`${studyCards.rating} > 0`);

    return {
      total: Number(totalResult[0]?.count ?? 0),
      completed: Number(completedResult[0]?.count ?? 0),
      avgRating: Number(avgRatingResult[0]?.avg ?? 0).toFixed(1),
    };
  }),
});
