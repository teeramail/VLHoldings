import { TRPCError } from "@trpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import {
  authedProcedure,
  createTRPCRouter,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import {
  studyCardShares,
  studyCards,
  CARD_VISIBILITIES,
  SHARE_PERMISSIONS,
} from "~/server/db/schema";
import {
  generateShareToken,
  requireCardOwnership,
} from "~/server/card-access";
import {
  registryRemoveShare,
  registryUpsertShare,
} from "~/server/registry";

async function ensureShareToken(
  cardId: number,
  currentToken: string | null,
): Promise<string> {
  if (currentToken) return currentToken;
  for (let i = 0; i < 5; i++) {
    const token = generateShareToken();
    try {
      await db
        .update(studyCards)
        .set({ shareToken: token })
        .where(and(eq(studyCards.id, cardId), isNull(studyCards.shareToken)));
      const [row] = await db
        .select({ shareToken: studyCards.shareToken })
        .from(studyCards)
        .where(eq(studyCards.id, cardId))
        .limit(1);
      if (row?.shareToken) return row.shareToken;
    } catch {
      // retry on collision
    }
  }
  throw new TRPCError({
    code: "INTERNAL_SERVER_ERROR",
    message: "Could not allocate share token",
  });
}

export const studyCardSharesRouter = createTRPCRouter({
  listShares: authedProcedure
    .input(z.object({ cardId: z.number() }))
    .query(async ({ ctx, input }) => {
      const ownership = await requireCardOwnership(input.cardId, {
        userId: ctx.userId,
        isOwner: ctx.isOwner,
      });
      if (!ownership.ok) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Owner only" });
      }
      const rows = await ctx.db
        .select()
        .from(studyCardShares)
        .where(eq(studyCardShares.cardId, input.cardId));
      return rows;
    }),

  addShare: authedProcedure
    .input(
      z.object({
        cardId: z.number(),
        email: z.string().email(),
        permission: z.enum(SHARE_PERMISSIONS).default("view"),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ownership = await requireCardOwnership(input.cardId, {
        userId: ctx.userId,
        isOwner: ctx.isOwner,
      });
      if (!ownership.ok) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Owner only" });
      }

      const email = input.email.trim().toLowerCase();

      const [card] = await ctx.db
        .select({
          shareToken: studyCards.shareToken,
          title: studyCards.title,
          imageUrl: studyCards.imageUrl,
        })
        .from(studyCards)
        .where(eq(studyCards.id, input.cardId))
        .limit(1);

      if (!card) throw new TRPCError({ code: "NOT_FOUND" });

      const token = await ensureShareToken(input.cardId, card.shareToken);

      await ctx.db
        .insert(studyCardShares)
        .values({
          cardId: input.cardId,
          email,
          permission: input.permission,
        })
        .onConflictDoUpdate({
          target: [studyCardShares.cardId, studyCardShares.email],
          set: { permission: input.permission },
        });

      await registryUpsertShare({
        cardShareToken: token,
        email,
        permission: input.permission,
        cardTitle: card.title,
        cardImageUrl: card.imageUrl,
      });

      return { ok: true, shareToken: token };
    }),

  removeShare: authedProcedure
    .input(z.object({ cardId: z.number(), email: z.string().email() }))
    .mutation(async ({ ctx, input }) => {
      const ownership = await requireCardOwnership(input.cardId, {
        userId: ctx.userId,
        isOwner: ctx.isOwner,
      });
      if (!ownership.ok) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Owner only" });
      }

      const email = input.email.trim().toLowerCase();

      const [card] = await ctx.db
        .select({ shareToken: studyCards.shareToken })
        .from(studyCards)
        .where(eq(studyCards.id, input.cardId))
        .limit(1);

      await ctx.db
        .delete(studyCardShares)
        .where(
          and(
            eq(studyCardShares.cardId, input.cardId),
            eq(studyCardShares.email, email),
          ),
        );

      if (card?.shareToken) {
        await registryRemoveShare(card.shareToken, email);
      }
      return { ok: true };
    }),

  setVisibility: authedProcedure
    .input(
      z.object({
        cardId: z.number(),
        visibility: z.enum(CARD_VISIBILITIES),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const ownership = await requireCardOwnership(input.cardId, {
        userId: ctx.userId,
        isOwner: ctx.isOwner,
      });
      if (!ownership.ok) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Owner only" });
      }

      const [card] = await ctx.db
        .select({ shareToken: studyCards.shareToken })
        .from(studyCards)
        .where(eq(studyCards.id, input.cardId))
        .limit(1);

      let token = card?.shareToken ?? null;
      if (input.visibility === "public" && !token) {
        token = await ensureShareToken(input.cardId, null);
      }

      await ctx.db
        .update(studyCards)
        .set({ visibility: input.visibility })
        .where(eq(studyCards.id, input.cardId));

      return { ok: true, shareToken: token };
    }),

  /**
   * Cards in THIS project that are shared with the currently signed-in email.
   * Returns minimal preview fields.
   */
  listSharedWithMe: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.userEmail) return [];
    const rows = await ctx.db
      .select({
        id: studyCards.id,
        title: studyCards.title,
        imageUrl: studyCards.imageUrl,
        category: studyCards.category,
        permission: studyCardShares.permission,
        shareToken: studyCards.shareToken,
      })
      .from(studyCardShares)
      .innerJoin(studyCards, eq(studyCardShares.cardId, studyCards.id))
      .where(eq(studyCardShares.email, ctx.userEmail));
    return rows;
  }),
});
