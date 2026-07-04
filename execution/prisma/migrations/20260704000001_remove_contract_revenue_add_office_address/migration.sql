-- AlterEnum: Remove renewal_t60 and renewal_t30 from AlertType
-- First check for any remaining alerts with these types and delete them.
DELETE FROM "alerts" WHERE "type" IN ('renewal_t60', 'renewal_t30');

BEGIN;
CREATE TYPE "AlertType_new" AS ENUM ('health_drop', 'stale_deal');
ALTER TABLE "alerts" ALTER COLUMN "type" TYPE "AlertType_new" USING ("type"::text::"AlertType_new");
ALTER TYPE "AlertType" RENAME TO "AlertType_old";
ALTER TYPE "AlertType_new" RENAME TO "AlertType";
DROP TYPE "public"."AlertType_old";
COMMIT;

-- AlterTable: clients — drop contract/revenue columns, add office_address, set default on engagement_type
ALTER TABLE "clients" DROP COLUMN IF EXISTS "annual_value",
DROP COLUMN IF EXISTS "contract_end",
DROP COLUMN IF EXISTS "contract_start",
DROP COLUMN IF EXISTS "monthly_value",
ADD COLUMN IF NOT EXISTS "office_address" TEXT,
ALTER COLUMN "engagement_type" SET DEFAULT 'project';
