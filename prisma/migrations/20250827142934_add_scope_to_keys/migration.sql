-- Add scopeSlug column to Keys table
-- This migration adds scope-based access control to unauthenticated requests

ALTER TABLE "Keys" ADD COLUMN "scopeSlug" TEXT;

-- Create index on scopeSlug for better query performance
CREATE INDEX "Keys_scopeSlug_idx" ON "Keys"("scopeSlug");

-- Add comment explaining the purpose
COMMENT ON COLUMN "Keys"."scopeSlug" IS 'Associates keys with specific scopes for granular access control';
