import { z } from "zod";

import {
  createTRPCRouter,
  ownerProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import {
  CARD_VISIBILITIES,
  projectSettings,
} from "~/server/db/schema";
import {
  getProjectAccessMode,
  parseAllowedEmails,
  serializeAllowedEmails,
} from "~/server/access-mode";

async function loadOrCreateSettings(
  db: Pick<typeof import("~/server/db").db, "select" | "insert">,
) {
  const existing = await db.select().from(projectSettings).limit(1);
  if (existing[0]) return existing[0];
  const [created] = await db
    .insert(projectSettings)
    .values({})
    .returning();
  if (!created) {
    throw new Error("Failed to initialise project settings row");
  }
  return created;
}

export const projectSettingsRouter = createTRPCRouter({
  /** Publicly readable — needed by the UI to know what's allowed. */
  get: publicProcedure.query(async ({ ctx }) => {
    const row = await loadOrCreateSettings(ctx.db);
    return {
      accessMode: getProjectAccessMode(),
      allowAnonCreate: row.allowAnonCreate,
      defaultCardVisibility: row.defaultCardVisibility,
      allowedEmails: Array.from(parseAllowedEmails(row.allowedEmails)),
    };
  }),

  /** Owner-only mutation. */
  update: ownerProcedure
    .input(
      z.object({
        allowAnonCreate: z.boolean().optional(),
        defaultCardVisibility: z.enum(CARD_VISIBILITIES).optional(),
        allowedEmails: z.array(z.string()).optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const row = await loadOrCreateSettings(ctx.db);
      const updates: Record<string, unknown> = {};
      if (input.allowAnonCreate !== undefined) {
        updates.allowAnonCreate = input.allowAnonCreate;
      }
      if (input.defaultCardVisibility !== undefined) {
        updates.defaultCardVisibility = input.defaultCardVisibility;
      }
      if (input.allowedEmails !== undefined) {
        updates.allowedEmails = serializeAllowedEmails(input.allowedEmails);
      }
      if (Object.keys(updates).length > 0) {
        const { eq } = await import("drizzle-orm");
        await ctx.db
          .update(projectSettings)
          .set(updates)
          .where(eq(projectSettings.id, row.id));
      }
      return { ok: true };
    }),
});
