-- Admin-editable packaging acknowledgement checkbox text. Purely additive —
-- null falls back to the storefront's hardcoded default, matching every
-- existing option.

-- AlterTable
ALTER TABLE "ProductPackagingOption" ADD COLUMN     "acknowledgementText" TEXT;
