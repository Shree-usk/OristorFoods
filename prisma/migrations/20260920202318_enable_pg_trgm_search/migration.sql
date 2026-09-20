-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pg_trgm";


-- CreateIndex (trigram, for fuzzy/typo-tolerant search — STORY-012)
CREATE INDEX "product_name_trgm_idx" ON "Product" USING gin ("name" gin_trgm_ops);
CREATE INDEX "product_short_description_trgm_idx" ON "Product" USING gin ("shortDescription" gin_trgm_ops);
