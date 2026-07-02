-- CreateEnum
CREATE TYPE "AlertType" AS ENUM ('renewal_t60', 'renewal_t30', 'health_drop', 'stale_deal');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('open', 'acknowledged', 'resolved');

-- AlterTable
ALTER TABLE "clients" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "renewed_from_lead_id" TEXT;

-- CreateTable
CREATE TABLE "alerts" (
    "id" TEXT NOT NULL,
    "type" "AlertType" NOT NULL,
    "client_id" TEXT,
    "lead_id" TEXT,
    "assigned_to" TEXT,
    "status" "AlertStatus" NOT NULL DEFAULT 'open',
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "dedupe_key" TEXT NOT NULL,

    CONSTRAINT "alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_health_snapshots" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "band" "HealthStatus" NOT NULL,
    "signal_activity" INTEGER NOT NULL,
    "signal_renewal" INTEGER NOT NULL,
    "signal_revenue" INTEGER NOT NULL,
    "signal_engagement" INTEGER NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_health_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "alerts_dedupe_key_key" ON "alerts"("dedupe_key");

-- CreateIndex
CREATE INDEX "alerts_client_id_status_idx" ON "alerts"("client_id", "status");

-- CreateIndex
CREATE INDEX "alerts_status_triggered_at_idx" ON "alerts"("status", "triggered_at");

-- CreateIndex
CREATE INDEX "client_health_snapshots_client_id_computed_at_idx" ON "client_health_snapshots"("client_id", "computed_at");

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_renewed_from_lead_id_fkey" FOREIGN KEY ("renewed_from_lead_id") REFERENCES "leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alerts" ADD CONSTRAINT "alerts_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_health_snapshots" ADD CONSTRAINT "client_health_snapshots_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
