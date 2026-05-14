import { sql } from "drizzle-orm";
import {
  index,
  integer,
  pgTableCreator,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type { AdapterAccountType } from "next-auth/adapters";

export const createTable = pgTableCreator((name) => `varit_${name}`);

const timestamps = {
  createdAt: timestamp({ withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------
// NextAuth tables (Drizzle adapter compatible)
// ---------------------------------------------------------------------------

export const users = createTable("user", {
  id: varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: varchar({ length: 255 }),
  email: varchar({ length: 320 }).notNull(),
  emailVerified: timestamp({ mode: "date", withTimezone: true }).default(
    sql`CURRENT_TIMESTAMP`,
  ),
  image: varchar({ length: 2048 }),
});

export const accounts = createTable(
  "account",
  {
    userId: varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar({ length: 255 }).$type<AdapterAccountType>().notNull(),
    provider: varchar({ length: 255 }).notNull(),
    providerAccountId: varchar({ length: 255 }).notNull(),
    refresh_token: text(),
    access_token: text(),
    expires_at: integer(),
    token_type: varchar({ length: 255 }),
    scope: varchar({ length: 255 }),
    id_token: text(),
    session_state: varchar({ length: 255 }),
  },
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const sessions = createTable(
  "session",
  {
    sessionToken: varchar({ length: 255 }).notNull().primaryKey(),
    userId: varchar({ length: 255 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp({ mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [index("session_user_id_idx").on(t.userId)],
);

export const verificationTokens = createTable(
  "verification_token",
  {
    identifier: varchar({ length: 255 }).notNull(),
    token: varchar({ length: 255 }).notNull(),
    expires: timestamp({ mode: "date", withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// ---------------------------------------------------------------------------
// Study cards + sharing
// ---------------------------------------------------------------------------

export const CARD_VISIBILITIES = ["public", "signed_in", "private"] as const;
export type CardVisibility = (typeof CARD_VISIBILITIES)[number];

export const SHARE_PERMISSIONS = ["view", "edit"] as const;
export type SharePermission = (typeof SHARE_PERMISSIONS)[number];

export const studyCards = createTable(
  "study_card",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    title: d.varchar({ length: 255 }).notNull(),
    description: d.text().notNull(),
    referenceUrl: d.varchar({ length: 2048 }),
    youtubeUrl: d.varchar({ length: 1024 }),
    imageUrl: d.varchar({ length: 2048 }),
    imageS3Key: d.varchar({ length: 1024 }),
    attachments: d.text(),
    groupCalendar: d.text(),
    expenses: d.text(),
    category: d.varchar({ length: 100 }),
    difficulty: d.varchar({ length: 20 }).default("medium"),
    tags: d.text(),
    isCompleted: d.boolean().default(false).notNull(),
    rating: d.integer().default(0),
    estimatedCost: d.integer().default(0),
    notes: d.text(),
    investDate: d.date(),
    ownerUserId: d
      .varchar({ length: 255 })
      .references(() => users.id, { onDelete: "set null" }),
    visibility: d.varchar({ length: 20 }).notNull().default("private"),
    shareToken: d.varchar({ length: 48 }),
    ...timestamps,
  }),
  (t) => [
    index("study_card_category_idx").on(t.category),
    index("study_card_difficulty_idx").on(t.difficulty),
    index("study_card_completed_idx").on(t.isCompleted),
    index("study_card_created_idx").on(t.createdAt),
    index("study_card_rating_idx").on(t.rating),
    index("study_card_cursor_idx").on(t.createdAt, t.id),
    index("study_card_owner_idx").on(t.ownerUserId),
    index("study_card_visibility_idx").on(t.visibility),
    uniqueIndex("study_card_share_token_uq").on(t.shareToken),
  ],
);

export const studyCardShares = createTable(
  "study_card_share",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    cardId: d
      .integer()
      .notNull()
      .references(() => studyCards.id, { onDelete: "cascade" }),
    email: d.varchar({ length: 320 }).notNull(),
    permission: d.varchar({ length: 10 }).notNull().default("view"),
    invitedAt: timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    acceptedAt: timestamp({ withTimezone: true }),
  }),
  (t) => [
    uniqueIndex("study_card_share_card_email_uq").on(t.cardId, t.email),
    index("study_card_share_email_idx").on(t.email),
    index("study_card_share_card_idx").on(t.cardId),
  ],
);

// ---------------------------------------------------------------------------
// Per-project settings (single-row table)
// ---------------------------------------------------------------------------

export const projectSettings = createTable("project_settings", (d) => ({
  id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
  allowAnonCreate: d.boolean().default(false).notNull(),
  defaultCardVisibility: d
    .varchar({ length: 20 })
    .notNull()
    .default("private"),
  allowedEmails: d.text(), // JSON-encoded array of lowercased emails
  ...timestamps,
}));

export const studyCardPosts = createTable(
  "study_card_post",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    cardId: d
      .integer()
      .notNull()
      .references(() => studyCards.id, { onDelete: "cascade" }),
    parentPostId: d.integer(),
    authorName: d.varchar({ length: 120 }).notNull().default("Anonymous"),
    content: d.text().notNull(),
    attachments: d.text(),
    ...timestamps,
  }),
  (t) => [
    index("study_card_post_card_idx").on(t.cardId),
    index("study_card_post_parent_idx").on(t.parentPostId),
    index("study_card_post_created_idx").on(t.createdAt),
  ]
);

export const studyCardItems = createTable(
  "study_card_item",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    cardId: d
      .integer()
      .notNull()
      .references(() => studyCards.id, { onDelete: "cascade" }),
    nameTitle: d.text().notNull(),
    description: d.text(),
    linkUrl: d.varchar({ length: 2048 }),
    value: d.integer().default(0).notNull(),
    itemDate: d.date(),
    media: d.text(),
    ...timestamps,
  }),
  (t) => [
    index("study_card_item_card_idx").on(t.cardId),
    index("study_card_item_date_idx").on(t.itemDate),
    index("study_card_item_created_idx").on(t.createdAt),
  ]
);
