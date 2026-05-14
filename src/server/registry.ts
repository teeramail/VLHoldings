import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, sql } from "drizzle-orm";
import postgres from "postgres";
import {
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

import { env } from "~/env";

/**
 * Cross-project share registry. A small shared Postgres schema that every
 * Cardx sibling writes to when a card is shared with a Google email, and
 * reads from when showing "Shared with me" cards from other projects.
 *
 * Only indexes grants — card content stays in each origin project's DB.
 */

export const sharedCards = pgTable(
  "cardx_shared_cards",
  {
    projectSlug: varchar("project_slug", { length: 64 }).notNull(),
    projectBaseUrl: varchar("project_base_url", { length: 512 }).notNull(),
    cardShareToken: varchar("card_share_token", { length: 48 }).notNull(),
    email: varchar("email", { length: 320 }).notNull(),
    permission: varchar("permission", { length: 10 }).notNull(),
    cardTitle: varchar("card_title", { length: 512 }),
    cardImageUrl: varchar("card_image_url", { length: 2048 }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex("cardx_shared_cards_pk").on(
      t.projectSlug,
      t.cardShareToken,
      t.email,
    ),
    index("cardx_shared_cards_email_idx").on(t.email),
  ],
);

let _registryDb: ReturnType<typeof drizzle> | null = null;
let _registryReady = false;

function getRegistryDb() {
  if (!env.REGISTRY_DATABASE_URL) return null;
  if (_registryDb) return _registryDb;
  const client = postgres(env.REGISTRY_DATABASE_URL, {
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  _registryDb = drizzle(client);
  return _registryDb;
}

async function ensureRegistrySchema(db: ReturnType<typeof drizzle>) {
  if (_registryReady) return;
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS cardx_shared_cards (
      project_slug varchar(64) NOT NULL,
      project_base_url varchar(512) NOT NULL,
      card_share_token varchar(48) NOT NULL,
      email varchar(320) NOT NULL,
      permission varchar(10) NOT NULL,
      card_title varchar(512),
      card_image_url varchar(2048),
      updated_at timestamptz NOT NULL DEFAULT NOW(),
      CONSTRAINT cardx_shared_cards_pk PRIMARY KEY (project_slug, card_share_token, email)
    );
  `);
  await db.execute(
    sql`CREATE INDEX IF NOT EXISTS cardx_shared_cards_email_idx ON cardx_shared_cards (email);`,
  );
  _registryReady = true;
}

export type RegistryUpsertInput = {
  cardShareToken: string;
  email: string;
  permission: "view" | "edit";
  cardTitle: string | null;
  cardImageUrl: string | null;
};

/** Upsert a share grant into the central registry. No-op if unconfigured. */
export async function registryUpsertShare(input: RegistryUpsertInput) {
  const db = getRegistryDb();
  if (!db) return;
  if (!env.PROJECT_BASE_URL) return;
  try {
    await ensureRegistrySchema(db);
    await db
      .insert(sharedCards)
      .values({
        projectSlug: env.PROJECT_SLUG,
        projectBaseUrl: env.PROJECT_BASE_URL,
        cardShareToken: input.cardShareToken,
        email: input.email.toLowerCase(),
        permission: input.permission,
        cardTitle: input.cardTitle,
        cardImageUrl: input.cardImageUrl,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          sharedCards.projectSlug,
          sharedCards.cardShareToken,
          sharedCards.email,
        ],
        set: {
          permission: input.permission,
          cardTitle: input.cardTitle,
          cardImageUrl: input.cardImageUrl,
          projectBaseUrl: env.PROJECT_BASE_URL,
          updatedAt: new Date(),
        },
      });
  } catch (err) {
    console.error("[registry] upsert failed", err);
  }
}

export async function registryRemoveShare(cardShareToken: string, email: string) {
  const db = getRegistryDb();
  if (!db) return;
  try {
    await ensureRegistrySchema(db);
    await db
      .delete(sharedCards)
      .where(
        and(
          eq(sharedCards.projectSlug, env.PROJECT_SLUG),
          eq(sharedCards.cardShareToken, cardShareToken),
          eq(sharedCards.email, email.toLowerCase()),
        ),
      );
  } catch (err) {
    console.error("[registry] remove failed", err);
  }
}

export type RegistryListEntry = {
  projectSlug: string;
  projectBaseUrl: string;
  cardShareToken: string;
  permission: "view" | "edit";
  cardTitle: string | null;
  cardImageUrl: string | null;
};

/**
 * List all share grants addressed to this email across all Cardx projects.
 * Excludes entries belonging to the current project (those are handled by
 * the local `listSharedWithMe` tRPC procedure instead).
 */
export async function registryListForEmail(
  email: string,
): Promise<RegistryListEntry[]> {
  const db = getRegistryDb();
  if (!db) return [];
  try {
    await ensureRegistrySchema(db);
    const rows = await db
      .select()
      .from(sharedCards)
      .where(
        and(
          eq(sharedCards.email, email.toLowerCase()),
          sql`${sharedCards.projectSlug} <> ${env.PROJECT_SLUG}`,
        ),
      );
    return rows.map((r) => ({
      projectSlug: r.projectSlug,
      projectBaseUrl: r.projectBaseUrl,
      cardShareToken: r.cardShareToken,
      permission: r.permission as "view" | "edit",
      cardTitle: r.cardTitle,
      cardImageUrl: r.cardImageUrl,
    }));
  } catch (err) {
    console.error("[registry] list failed", err);
    return [];
  }
}
