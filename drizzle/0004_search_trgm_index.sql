CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS study_card_search_gin ON "varit_study_card"
  USING GIN ((title || ' ' || coalesce(description, '')) gin_trgm_ops);
