-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'commercial_director', 'account_manager', 'account', 'operation', 'hr', 'finance');

-- CreateEnum
CREATE TYPE "EngagementType" AS ENUM ('retainer', 'project', 'both');

-- CreateEnum
CREATE TYPE "HealthStatus" AS ENUM ('healthy', 'at_risk', 'churned');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('active', 'inactive', 'lead');

-- CreateEnum
CREATE TYPE "UpsellStatus" AS ENUM ('identified', 'pitched', 'won', 'lost');

-- CreateEnum
CREATE TYPE "PipelineStage" AS ENUM ('leads', 'pipeline', 'negotiation', 'closed_won', 'lost_deal', 'invoiced', 'contract_renewal', 'no_response');

-- CreateEnum
CREATE TYPE "ProjectType" AS ENUM ('one_time', 'retainer');

-- CreateEnum
CREATE TYPE "ProductLine" AS ENUM ('stracomm', 'smm', 'creative_strategy', 'media_buying', 'ads_management', 'production', 'others');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('quotation', 'quotation_signed', 'contract', 'other');

-- CreateEnum
CREATE TYPE "TargetType" AS ENUM ('monthly', 'quarterly');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'account',
    "division" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_vp" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "engagement_type" "EngagementType" NOT NULL,
    "contract_start" DATE,
    "contract_end" DATE,
    "monthly_value" DECIMAL(15,2),
    "annual_value" DECIMAL(15,2),
    "health_status" "HealthStatus" NOT NULL DEFAULT 'healthy',
    "primary_ae" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "customer_code" TEXT,
    "org_size" TEXT,
    "client_status" "ClientStatus",

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_field_history" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_field_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "upsell_opportunities" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "status" "UpsellStatus" NOT NULL DEFAULT 'identified',
    "estimated_value" DECIMAL(15,2),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "upsell_opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "leads" (
    "id" TEXT NOT NULL,
    "stage" "PipelineStage" NOT NULL DEFAULT 'leads',
    "project_type" "ProjectType" NOT NULL,
    "billing_plan" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "actual_revenue" DECIMAL(15,2),
    "client_id" TEXT NOT NULL,
    "description" TEXT,
    "invoice_requested_at" TIMESTAMP(3),
    "loss_deal_reason" TEXT,
    "product_line" "ProductLine" NOT NULL,
    "projected_revenue" DECIMAL(15,2),
    "sales_id" TEXT,
    "quarter" TEXT,
    "expected_close_date" TIMESTAMP(3),

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_stage_history" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "from_stage" "PipelineStage" NOT NULL,
    "to_stage" "PipelineStage" NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lead_field_history" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_field_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pipeline_documents" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "file_url" TEXT NOT NULL,
    "uploaded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "file_name" TEXT,

    CONSTRAINT "pipeline_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "targets" (
    "id" TEXT NOT NULL,
    "period_month" INTEGER NOT NULL,
    "period_year" INTEGER NOT NULL,
    "revenue_target" DECIMAL(15,2) NOT NULL,
    "new_client_target" INTEGER NOT NULL DEFAULT 0,
    "type" "TargetType" NOT NULL DEFAULT 'monthly',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "sales_id" TEXT,

    CONSTRAINT "targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_config" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_config_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "clients_customer_code_key" ON "clients"("customer_code");

-- CreateIndex
CREATE UNIQUE INDEX "targets_period_month_period_year_type_sales_id_key" ON "targets"("period_month", "period_year", "type", "sales_id");

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_primary_ae_fkey" FOREIGN KEY ("primary_ae") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_field_history" ADD CONSTRAINT "client_field_history_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_field_history" ADD CONSTRAINT "client_field_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "upsell_opportunities" ADD CONSTRAINT "upsell_opportunities_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "leads" ADD CONSTRAINT "leads_sales_id_fkey" FOREIGN KEY ("sales_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_stage_history" ADD CONSTRAINT "lead_stage_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_field_history" ADD CONSTRAINT "lead_field_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lead_field_history" ADD CONSTRAINT "lead_field_history_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_documents" ADD CONSTRAINT "pipeline_documents_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipeline_documents" ADD CONSTRAINT "pipeline_documents_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "targets" ADD CONSTRAINT "targets_sales_id_fkey" FOREIGN KEY ("sales_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

