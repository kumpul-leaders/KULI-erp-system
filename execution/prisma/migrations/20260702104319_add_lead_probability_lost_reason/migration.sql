-- CreateEnum
CREATE TYPE "LostReason" AS ENUM ('budget', 'competitor', 'timing', 'no_decision', 'requirements_mismatch', 'other');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "lost_reason" "LostReason",
ADD COLUMN     "probability" DECIMAL(5,2),
ADD COLUMN     "probability_is_manual" BOOLEAN NOT NULL DEFAULT false;
