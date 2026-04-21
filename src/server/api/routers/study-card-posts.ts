import { TRPCError } from "@trpc/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { studyCardPosts, studyCards } from "~/server/db/schema";

const postInputSchema = z.object({
  cardId: z.number().int().positive(),
  authorName: z.string().trim().max(120).optional(),
  content: z.string().trim().min(1),
  attachments: z.string().optional(),
});

export const studyCardPostsRouter = createTRPCRouter({
  listByCardId: publicProcedure
    .input(z.object({ cardId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const allPosts = await ctx.db
        .select({
          id: studyCardPosts.id,
          cardId: studyCardPosts.cardId,
          parentPostId: studyCardPosts.parentPostId,
          authorName: studyCardPosts.authorName,
          content: studyCardPosts.content,
          attachments: studyCardPosts.attachments,
          createdAt: studyCardPosts.createdAt,
        })
        .from(studyCardPosts)
        .where(eq(studyCardPosts.cardId, input.cardId))
        .orderBy(asc(studyCardPosts.createdAt), asc(studyCardPosts.id));

      const topLevelPosts = allPosts.filter(p => !p.parentPostId);
      const repliesByParent = new Map<number, typeof allPosts>();

      for (const post of allPosts) {
        if (!post.parentPostId) continue;
        const existing = repliesByParent.get(post.parentPostId) ?? [];
        existing.push(post);
        repliesByParent.set(post.parentPostId, existing);
      }

      return topLevelPosts.map((post) => ({
        ...post,
        replies: repliesByParent.get(post.id) ?? [],
      }));
    }),

  create: publicProcedure
    .input(postInputSchema)
    .mutation(async ({ ctx, input }) => {
      const existingCard = await ctx.db
        .select({ id: studyCards.id })
        .from(studyCards)
        .where(eq(studyCards.id, input.cardId))
        .limit(1);

      if (!existingCard[0]) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card not found",
        });
      }

      const result = await ctx.db
        .insert(studyCardPosts)
        .values({
          cardId: input.cardId,
          authorName: input.authorName?.trim() || "Anonymous",
          content: input.content.trim(),
          attachments: input.attachments ?? null,
        })
        .returning();

      return result[0];
    }),

  answer: publicProcedure
    .input(
      z.object({
        postId: z.number().int().positive(),
        authorName: z.string().trim().max(120).optional(),
        content: z.string().trim().min(1),
        attachments: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const parentRows = await ctx.db
        .select({ id: studyCardPosts.id, cardId: studyCardPosts.cardId })
        .from(studyCardPosts)
        .where(eq(studyCardPosts.id, input.postId))
        .limit(1);

      const parentPost = parentRows[0];
      if (!parentPost) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Post not found",
        });
      }

      const result = await ctx.db
        .insert(studyCardPosts)
        .values({
          cardId: parentPost.cardId,
          parentPostId: parentPost.id,
          authorName: input.authorName?.trim() || "Anonymous",
          content: input.content.trim(),
          attachments: input.attachments ?? null,
        })
        .returning();

      return result[0];
    }),
});
