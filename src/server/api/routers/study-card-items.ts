import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getCardPermissions } from "~/config/card-settings";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { studyCardItems, studyCards } from "~/server/db/schema";
import { generateDownloadUrl } from "~/server/s3";

const mediaSchema = z
  .object({
    fileName: z.string(),
    originalName: z.string(),
    mimeType: z.string(),
    fileSize: z.number().min(0),
    s3Key: z.string(),
    url: z.string().url(),
    subfolder: z.string().optional(),
  })
  .nullable();

function parseMedia(rawMedia: string | null) {
  if (!rawMedia) return null;
  try {
    const parsed = JSON.parse(rawMedia) as unknown;
    const validated = mediaSchema.safeParse(parsed);
    return validated.success ? validated.data : null;
  } catch {
    return null;
  }
}

async function mapItemForResponse(item: {
  id: number;
  cardId: number;
  nameTitle: string;
  linkUrl: string | null;
  value: number;
  itemDate: string | null;
  media: string | null;
  createdAt: Date;
  updatedAt: Date | null;
}) {
  const parsedMedia = parseMedia(item.media);
  if (!parsedMedia) {
    return {
      ...item,
      media: null,
    };
  }

  const signedUrl = await generateDownloadUrl(parsedMedia.s3Key);
  return {
    ...item,
    media: {
      ...parsedMedia,
      url: signedUrl,
    },
  };
}

export const studyCardItemsRouter = createTRPCRouter({
  listByCardId: publicProcedure
    .input(z.object({ cardId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const items = await ctx.db
        .select()
        .from(studyCardItems)
        .where(eq(studyCardItems.cardId, input.cardId))
        .orderBy(desc(studyCardItems.createdAt), desc(studyCardItems.id));

      return Promise.all(items.map(mapItemForResponse));
    }),

  create: publicProcedure
    .input(
      z.object({
        cardId: z.number().int().positive(),
        nameTitle: z.string().trim().min(1),
        linkUrl: z.string().url().optional(),
        value: z.number().int().optional(),
        itemDate: z.string().optional(),
        media: mediaSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const card = await ctx.db
        .select({ id: studyCards.id, title: studyCards.title })
        .from(studyCards)
        .where(eq(studyCards.id, input.cardId))
        .limit(1);

      const cardRow = card[0];
      if (!cardRow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card not found",
        });
      }

      if (!getCardPermissions(cardRow.title).canEditCard) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This card is locked and cannot be edited",
        });
      }

      const result = await ctx.db
        .insert(studyCardItems)
        .values({
          cardId: input.cardId,
          nameTitle: input.nameTitle,
          linkUrl: input.linkUrl ?? null,
          value: input.value ?? 0,
          itemDate: input.itemDate ?? null,
          media: input.media ? JSON.stringify(input.media) : null,
        })
        .returning();
      const created = result[0];
      if (!created) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Failed to create item",
        });
      }

      return await mapItemForResponse(created);
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        nameTitle: z.string().trim().min(1).optional(),
        linkUrl: z.string().url().optional(),
        value: z.number().int().optional(),
        itemDate: z.string().optional(),
        media: mediaSchema.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...updates } = input;

      const existing = await ctx.db
        .select({ id: studyCardItems.id, cardId: studyCardItems.cardId })
        .from(studyCardItems)
        .where(eq(studyCardItems.id, id))
        .limit(1);

      const existingItem = existing[0];
      if (!existingItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      const card = await ctx.db
        .select({ title: studyCards.title })
        .from(studyCards)
        .where(eq(studyCards.id, existingItem.cardId))
        .limit(1);
      const cardRow = card[0];

      if (!cardRow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card not found",
        });
      }

      if (!getCardPermissions(cardRow.title).canEditCard) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This card is locked and cannot be edited",
        });
      }

      const payload: {
        nameTitle?: string;
        linkUrl?: string | null;
        value?: number;
        itemDate?: string | null;
        media?: string | null;
      } = {};

      if (updates.nameTitle !== undefined) payload.nameTitle = updates.nameTitle;
      if (updates.linkUrl !== undefined) payload.linkUrl = updates.linkUrl || null;
      if (updates.value !== undefined) payload.value = updates.value;
      if (updates.itemDate !== undefined) payload.itemDate = updates.itemDate || null;
      if (updates.media !== undefined) payload.media = updates.media ? JSON.stringify(updates.media) : null;

      const result = await ctx.db
        .update(studyCardItems)
        .set(payload)
        .where(eq(studyCardItems.id, id))
        .returning();
      const updated = result[0];
      if (!updated) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      return await mapItemForResponse(updated);
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db
        .select({ id: studyCardItems.id, cardId: studyCardItems.cardId })
        .from(studyCardItems)
        .where(eq(studyCardItems.id, input.id))
        .limit(1);

      const existingItem = existing[0];
      if (!existingItem) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Item not found",
        });
      }

      const card = await ctx.db
        .select({ title: studyCards.title })
        .from(studyCards)
        .where(eq(studyCards.id, existingItem.cardId))
        .limit(1);
      const cardRow = card[0];

      if (!cardRow) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Card not found",
        });
      }

      if (!getCardPermissions(cardRow.title).canEditCard) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "This card is locked and cannot be edited",
        });
      }

      await ctx.db.delete(studyCardItems).where(eq(studyCardItems.id, input.id));
      return { success: true };
    }),
});
