-- Add saved query metadata to existing view sections.
ALTER TABLE "ViewSection" ADD COLUMN "displayType" TEXT NOT NULL DEFAULT 'list';
ALTER TABLE "ViewSection" ADD COLUMN "query" TEXT;
