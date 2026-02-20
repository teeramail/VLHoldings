DROP TABLE "varit_folder" CASCADE;--> statement-breakpoint
DROP TABLE "varit_media_item" CASCADE;--> statement-breakpoint
ALTER TABLE "varit_study_card" ADD COLUMN "referenceUrl" varchar(2048);--> statement-breakpoint
ALTER TABLE "varit_study_card" ADD COLUMN "attachments" text;--> statement-breakpoint
ALTER TABLE "varit_study_card" ADD COLUMN "estimatedCost" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "varit_study_card" ADD COLUMN "investDate" date;