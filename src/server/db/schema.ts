import { index, pgTableCreator } from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `varit_${name}`);

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
    category: d.varchar({ length: 100 }),
    difficulty: d.varchar({ length: 20 }).default("medium"),
    tags: d.text(),
    isCompleted: d.boolean().default(false).notNull(),
    rating: d.integer().default(0),
    estimatedCost: d.integer().default(0),
    notes: d.text(),
    investDate: d.date(),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("study_card_category_idx").on(t.category),
    index("study_card_difficulty_idx").on(t.difficulty),
    index("study_card_completed_idx").on(t.isCompleted),
    index("study_card_created_idx").on(t.createdAt),
    index("study_card_rating_idx").on(t.rating),
  ]
);
