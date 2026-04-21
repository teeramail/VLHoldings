import { index, pgTableCreator, timestamp } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `varit_${name}`);

const timestamps = {
  createdAt: timestamp({ withTimezone: true })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
};

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
    ...timestamps,
  }),
  (t) => [
    index("study_card_category_idx").on(t.category),
    index("study_card_difficulty_idx").on(t.difficulty),
    index("study_card_completed_idx").on(t.isCompleted),
    index("study_card_created_idx").on(t.createdAt),
    index("study_card_rating_idx").on(t.rating),
  ]
);

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
    linkUrl: d.varchar({ length: 2048 }),
    value: d.integer().default(0).notNull(),
    itemDate: d.date(),
    media: d.text(),
    ...timestamps,
  }),
  (t) => [
    index("study_card_item_card_idx").on(t.cardId),
    index("study_card_item_created_idx").on(t.createdAt),
  ]
);
