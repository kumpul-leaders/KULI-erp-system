-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('call', 'email', 'meeting', 'todo', 'deadline');

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('open', 'done', 'canceled');

-- AlterTable
ALTER TABLE "leads" ADD COLUMN     "next_activity_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "note" TEXT,
    "due_date" DATE NOT NULL,
    "status" "ActivityStatus" NOT NULL DEFAULT 'open',
    "done_at" TIMESTAMP(3),
    "lead_id" TEXT,
    "client_id" TEXT,
    "assigned_to" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activities_assigned_to_status_due_date_idx" ON "activities"("assigned_to", "status", "due_date");

-- CreateIndex
CREATE INDEX "activities_lead_id_status_idx" ON "activities"("lead_id", "status");

-- CreateIndex
CREATE INDEX "activities_client_id_status_idx" ON "activities"("client_id", "status");

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activities" ADD CONSTRAINT "activities_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
