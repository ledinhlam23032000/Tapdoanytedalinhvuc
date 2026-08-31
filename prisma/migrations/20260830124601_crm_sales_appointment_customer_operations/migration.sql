-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CustomerJourneyStage" AS ENUM ('NEW', 'CONTACTING', 'ENGAGED', 'APPOINTED', 'ACTIVE', 'FOLLOW_UP', 'INACTIVE');

-- CreateEnum
CREATE TYPE "CustomerInteractionType" AS ENUM ('CALL', 'SMS', 'CHAT', 'MEETING', 'EMAIL', 'NOTE');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('SCHEDULED', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "CatalogItemType" AS ENUM ('PRODUCT', 'SERVICE');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED');

-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN     "appointmentId" TEXT,
ADD COLUMN     "customerId" TEXT;

-- CreateTable
CREATE TABLE "CustomerSource" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phoneCiphertext" TEXT,
    "phoneHash" TEXT,
    "email" TEXT,
    "sourceId" TEXT,
    "ownerUserId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "convertedCustomerId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "phoneCiphertext" TEXT,
    "phoneHash" TEXT,
    "email" TEXT,
    "address" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "journeyStage" "CustomerJourneyStage" NOT NULL DEFAULT 'NEW',
    "sourceId" TEXT,
    "ownerUserId" TEXT,
    "organizationUnitId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerInteraction" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "CustomerInteractionType" NOT NULL,
    "summary" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "performedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerInteraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Appointment" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT,
    "organizationUnitId" TEXT,
    "assignedUserId" TEXT,
    "type" TEXT,
    "title" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3),
    "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
    "location" TEXT,
    "note" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "type" "CatalogItemType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultPrice" DECIMAL(18,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT,
    "customerId" TEXT,
    "organizationUnitId" TEXT,
    "projectId" TEXT,
    "salespersonUserId" TEXT,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "confirmedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerSource_companyId_idx" ON "CustomerSource"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerSource_companyId_code_key" ON "CustomerSource"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_convertedCustomerId_key" ON "Lead"("convertedCustomerId");

-- CreateIndex
CREATE INDEX "Lead_companyId_status_idx" ON "Lead"("companyId", "status");

-- CreateIndex
CREATE INDEX "Lead_companyId_phoneHash_idx" ON "Lead"("companyId", "phoneHash");

-- CreateIndex
CREATE INDEX "Lead_ownerUserId_idx" ON "Lead"("ownerUserId");

-- CreateIndex
CREATE INDEX "Customer_companyId_phoneHash_idx" ON "Customer"("companyId", "phoneHash");

-- CreateIndex
CREATE INDEX "Customer_companyId_ownerUserId_idx" ON "Customer"("companyId", "ownerUserId");

-- CreateIndex
CREATE INDEX "Customer_companyId_createdAt_idx" ON "Customer"("companyId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_code_key" ON "Customer"("companyId", "code");

-- CreateIndex
CREATE INDEX "CustomerInteraction_companyId_customerId_occurredAt_idx" ON "CustomerInteraction"("companyId", "customerId", "occurredAt");

-- CreateIndex
CREATE INDEX "Appointment_companyId_startAt_idx" ON "Appointment"("companyId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_companyId_assignedUserId_startAt_idx" ON "Appointment"("companyId", "assignedUserId", "startAt");

-- CreateIndex
CREATE INDEX "Appointment_companyId_customerId_idx" ON "Appointment"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "CatalogItem_companyId_active_idx" ON "CatalogItem"("companyId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogItem_companyId_code_key" ON "CatalogItem"("companyId", "code");

-- CreateIndex
CREATE INDEX "Sale_companyId_createdAt_idx" ON "Sale"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Sale_companyId_customerId_idx" ON "Sale"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "Sale_companyId_salespersonUserId_idx" ON "Sale"("companyId", "salespersonUserId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_companyId_code_key" ON "Sale"("companyId", "code");

-- CreateIndex
CREATE INDEX "SaleLine_saleId_idx" ON "SaleLine"("saleId");

-- CreateIndex
CREATE INDEX "WorkItem_customerId_idx" ON "WorkItem"("customerId");

-- CreateIndex
CREATE INDEX "WorkItem_appointmentId_idx" ON "WorkItem"("appointmentId");

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerSource" ADD CONSTRAINT "CustomerSource_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CustomerSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "CustomerSource"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInteraction" ADD CONSTRAINT "CustomerInteraction_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInteraction" ADD CONSTRAINT "CustomerInteraction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerInteraction" ADD CONSTRAINT "CustomerInteraction_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogItem" ADD CONSTRAINT "CatalogItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_salespersonUserId_fkey" FOREIGN KEY ("salespersonUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
