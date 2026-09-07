-- CreateEnum
CREATE TYPE "CompanyModuleType" AS ENUM ('HEALTHCARE');

-- CreateEnum
CREATE TYPE "MedicalCaseStatus" AS ENUM ('OPEN', 'IN_TREATMENT', 'FOLLOW_UP', 'CLOSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MedicalCaseType" AS ENUM ('CONSULTATION', 'TREATMENT', 'AESTHETIC_PROCEDURE', 'FOLLOW_UP', 'OTHER');

-- CreateEnum
CREATE TYPE "ClinicalRecordStatus" AS ENUM ('DRAFT', 'FINAL');

-- CreateEnum
CREATE TYPE "ScreeningAnswer" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "ProcedureStatus" AS ENUM ('PLANNED', 'READY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProcedureMaterialUsageStatus" AS ENUM ('RECORDED', 'REVERSED');

-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('PROCEDURE', 'ANESTHESIA', 'PHOTO_USAGE', 'DATA_PROCESSING', 'OTHER');

-- CreateEnum
CREATE TYPE "ConsentStatus" AS ENUM ('DRAFT', 'SIGNED', 'REVOKED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ClinicalPhotoType" AS ENUM ('BEFORE', 'AFTER', 'PROGRESS', 'CLINICAL_FINDING', 'OTHER');

-- CreateEnum
CREATE TYPE "MedicalFollowUpStatus" AS ENUM ('PLANNED', 'DUE', 'DONE', 'MISSED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "StockMovementSourceType" ADD VALUE 'PROCEDURE_MATERIAL_USAGE';

-- CreateTable
CREATE TABLE "CompanyModule" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "module" "CompanyModuleType" NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enabledByUserId" TEXT NOT NULL,
    "disabledAt" TIMESTAMP(3),

    CONSTRAINT "CompanyModule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalCase" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "code" TEXT,
    "caseType" "MedicalCaseType" NOT NULL DEFAULT 'CONSULTATION',
    "status" "MedicalCaseStatus" NOT NULL DEFAULT 'OPEN',
    "chiefComplaint" TEXT,
    "primaryClinicianUserId" TEXT,
    "organizationUnitId" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "closeReason" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HealthcareAppointmentContext" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "medicalCaseId" TEXT NOT NULL,
    "purpose" TEXT,
    "specialty" TEXT,

    CONSTRAINT "HealthcareAppointmentContext_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalConsultation" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "medicalCaseId" TEXT NOT NULL,
    "clinicianUserId" TEXT NOT NULL,
    "status" "ClinicalRecordStatus" NOT NULL DEFAULT 'DRAFT',
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "finalizedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalConsultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalConsultationAddendum" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalConsultationAddendum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalScreeningItem" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "itemKey" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" "ScreeningAnswer",
    "note" TEXT,
    "recordedAt" TIMESTAMP(3),

    CONSTRAINT "ClinicalScreeningItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procedure" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "medicalCaseId" TEXT NOT NULL,
    "catalogItemId" TEXT,
    "saleLineId" TEXT,
    "procedureType" TEXT,
    "status" "ProcedureStatus" NOT NULL DEFAULT 'PLANNED',
    "primaryClinicianUserId" TEXT,
    "organizationUnitId" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "performedAt" TIMESTAMP(3),
    "clinicalNotes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "completedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcedureMaterialUsage" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "procedureId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "inventoryLocationId" TEXT NOT NULL,
    "quantity" DECIMAL(18,3) NOT NULL,
    "status" "ProcedureMaterialUsageStatus" NOT NULL DEFAULT 'RECORDED',
    "stockMovementId" TEXT,
    "reversalReason" TEXT,
    "recordedByUserId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcedureMaterialUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "consentType" "ConsentType" NOT NULL DEFAULT 'PROCEDURE',
    "status" "ArchivableStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "medicalCaseId" TEXT NOT NULL,
    "consentTemplateId" TEXT,
    "consentType" "ConsentType" NOT NULL DEFAULT 'PROCEDURE',
    "status" "ConsentStatus" NOT NULL DEFAULT 'DRAFT',
    "titleSnapshot" TEXT NOT NULL,
    "bodySnapshot" TEXT NOT NULL,
    "templateVersion" INTEGER,
    "signedAt" TIMESTAMP(3),
    "signedByCustomerId" TEXT,
    "signerName" TEXT,
    "signerRelationship" TEXT,
    "revokedAt" TIMESTAMP(3),
    "revokedByUserId" TEXT,
    "revokeReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalPhoto" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "medicalCaseId" TEXT NOT NULL,
    "procedureId" TEXT,
    "photoType" "ClinicalPhotoType" NOT NULL DEFAULT 'CLINICAL_FINDING',
    "bodyArea" TEXT,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksumSha256" TEXT NOT NULL,
    "status" "ArchivableStatus" NOT NULL DEFAULT 'ACTIVE',
    "archiveReason" TEXT,
    "archivedAt" TIMESTAMP(3),
    "archivedByUserId" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicalFollowUp" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "medicalCaseId" TEXT NOT NULL,
    "procedureId" TEXT,
    "workItemId" TEXT,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "MedicalFollowUpStatus" NOT NULL DEFAULT 'PLANNED',
    "clinicalOutcome" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MedicalFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyModule_companyId_idx" ON "CompanyModule"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyModule_companyId_module_key" ON "CompanyModule"("companyId", "module");

-- CreateIndex
CREATE INDEX "MedicalCase_companyId_status_openedAt_idx" ON "MedicalCase"("companyId", "status", "openedAt");

-- CreateIndex
CREATE INDEX "MedicalCase_companyId_customerId_idx" ON "MedicalCase"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "MedicalCase_companyId_primaryClinicianUserId_idx" ON "MedicalCase"("companyId", "primaryClinicianUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MedicalCase_companyId_code_key" ON "MedicalCase"("companyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "HealthcareAppointmentContext_appointmentId_key" ON "HealthcareAppointmentContext"("appointmentId");

-- CreateIndex
CREATE INDEX "HealthcareAppointmentContext_companyId_medicalCaseId_idx" ON "HealthcareAppointmentContext"("companyId", "medicalCaseId");

-- CreateIndex
CREATE INDEX "ClinicalConsultation_companyId_medicalCaseId_createdAt_idx" ON "ClinicalConsultation"("companyId", "medicalCaseId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalConsultation_companyId_status_idx" ON "ClinicalConsultation"("companyId", "status");

-- CreateIndex
CREATE INDEX "ClinicalConsultationAddendum_companyId_consultationId_creat_idx" ON "ClinicalConsultationAddendum"("companyId", "consultationId", "createdAt");

-- CreateIndex
CREATE INDEX "ClinicalScreeningItem_companyId_consultationId_idx" ON "ClinicalScreeningItem"("companyId", "consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalScreeningItem_consultationId_itemKey_key" ON "ClinicalScreeningItem"("consultationId", "itemKey");

-- CreateIndex
CREATE INDEX "Procedure_companyId_medicalCaseId_idx" ON "Procedure"("companyId", "medicalCaseId");

-- CreateIndex
CREATE INDEX "Procedure_companyId_status_scheduledAt_idx" ON "Procedure"("companyId", "status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Procedure_companyId_saleLineId_idx" ON "Procedure"("companyId", "saleLineId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcedureMaterialUsage_stockMovementId_key" ON "ProcedureMaterialUsage"("stockMovementId");

-- CreateIndex
CREATE INDEX "ProcedureMaterialUsage_companyId_procedureId_idx" ON "ProcedureMaterialUsage"("companyId", "procedureId");

-- CreateIndex
CREATE INDEX "ProcedureMaterialUsage_companyId_inventoryItemId_idx" ON "ProcedureMaterialUsage"("companyId", "inventoryItemId");

-- CreateIndex
CREATE INDEX "ConsentTemplate_companyId_status_idx" ON "ConsentTemplate"("companyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ConsentTemplate_companyId_code_version_key" ON "ConsentTemplate"("companyId", "code", "version");

-- CreateIndex
CREATE INDEX "ConsentRecord_companyId_medicalCaseId_status_idx" ON "ConsentRecord"("companyId", "medicalCaseId", "status");

-- CreateIndex
CREATE INDEX "ConsentRecord_companyId_consentType_status_idx" ON "ConsentRecord"("companyId", "consentType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ClinicalPhoto_storageKey_key" ON "ClinicalPhoto"("storageKey");

-- CreateIndex
CREATE INDEX "ClinicalPhoto_companyId_medicalCaseId_status_idx" ON "ClinicalPhoto"("companyId", "medicalCaseId", "status");

-- CreateIndex
CREATE INDEX "ClinicalPhoto_companyId_procedureId_idx" ON "ClinicalPhoto"("companyId", "procedureId");

-- CreateIndex
CREATE INDEX "MedicalFollowUp_companyId_medicalCaseId_idx" ON "MedicalFollowUp"("companyId", "medicalCaseId");

-- CreateIndex
CREATE INDEX "MedicalFollowUp_companyId_status_scheduledFor_idx" ON "MedicalFollowUp"("companyId", "status", "scheduledFor");

-- AddForeignKey
ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyModule" ADD CONSTRAINT "CompanyModule_enabledByUserId_fkey" FOREIGN KEY ("enabledByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalCase" ADD CONSTRAINT "MedicalCase_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalCase" ADD CONSTRAINT "MedicalCase_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalCase" ADD CONSTRAINT "MedicalCase_primaryClinicianUserId_fkey" FOREIGN KEY ("primaryClinicianUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalCase" ADD CONSTRAINT "MedicalCase_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalCase" ADD CONSTRAINT "MedicalCase_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareAppointmentContext" ADD CONSTRAINT "HealthcareAppointmentContext_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareAppointmentContext" ADD CONSTRAINT "HealthcareAppointmentContext_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HealthcareAppointmentContext" ADD CONSTRAINT "HealthcareAppointmentContext_medicalCaseId_fkey" FOREIGN KEY ("medicalCaseId") REFERENCES "MedicalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalConsultation" ADD CONSTRAINT "ClinicalConsultation_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalConsultation" ADD CONSTRAINT "ClinicalConsultation_medicalCaseId_fkey" FOREIGN KEY ("medicalCaseId") REFERENCES "MedicalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalConsultation" ADD CONSTRAINT "ClinicalConsultation_clinicianUserId_fkey" FOREIGN KEY ("clinicianUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalConsultation" ADD CONSTRAINT "ClinicalConsultation_finalizedByUserId_fkey" FOREIGN KEY ("finalizedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalConsultationAddendum" ADD CONSTRAINT "ClinicalConsultationAddendum_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalConsultationAddendum" ADD CONSTRAINT "ClinicalConsultationAddendum_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "ClinicalConsultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalConsultationAddendum" ADD CONSTRAINT "ClinicalConsultationAddendum_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalScreeningItem" ADD CONSTRAINT "ClinicalScreeningItem_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalScreeningItem" ADD CONSTRAINT "ClinicalScreeningItem_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "ClinicalConsultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_medicalCaseId_fkey" FOREIGN KEY ("medicalCaseId") REFERENCES "MedicalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_catalogItemId_fkey" FOREIGN KEY ("catalogItemId") REFERENCES "CatalogItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "SaleLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_primaryClinicianUserId_fkey" FOREIGN KEY ("primaryClinicianUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_organizationUnitId_fkey" FOREIGN KEY ("organizationUnitId") REFERENCES "OrganizationUnit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureMaterialUsage" ADD CONSTRAINT "ProcedureMaterialUsage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureMaterialUsage" ADD CONSTRAINT "ProcedureMaterialUsage_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureMaterialUsage" ADD CONSTRAINT "ProcedureMaterialUsage_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureMaterialUsage" ADD CONSTRAINT "ProcedureMaterialUsage_inventoryLocationId_fkey" FOREIGN KEY ("inventoryLocationId") REFERENCES "InventoryLocation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureMaterialUsage" ADD CONSTRAINT "ProcedureMaterialUsage_stockMovementId_fkey" FOREIGN KEY ("stockMovementId") REFERENCES "StockMovement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureMaterialUsage" ADD CONSTRAINT "ProcedureMaterialUsage_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentTemplate" ADD CONSTRAINT "ConsentTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentTemplate" ADD CONSTRAINT "ConsentTemplate_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_medicalCaseId_fkey" FOREIGN KEY ("medicalCaseId") REFERENCES "MedicalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_consentTemplateId_fkey" FOREIGN KEY ("consentTemplateId") REFERENCES "ConsentTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_signedByCustomerId_fkey" FOREIGN KEY ("signedByCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_revokedByUserId_fkey" FOREIGN KEY ("revokedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPhoto" ADD CONSTRAINT "ClinicalPhoto_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPhoto" ADD CONSTRAINT "ClinicalPhoto_medicalCaseId_fkey" FOREIGN KEY ("medicalCaseId") REFERENCES "MedicalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPhoto" ADD CONSTRAINT "ClinicalPhoto_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPhoto" ADD CONSTRAINT "ClinicalPhoto_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalPhoto" ADD CONSTRAINT "ClinicalPhoto_archivedByUserId_fkey" FOREIGN KEY ("archivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalFollowUp" ADD CONSTRAINT "MedicalFollowUp_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalFollowUp" ADD CONSTRAINT "MedicalFollowUp_medicalCaseId_fkey" FOREIGN KEY ("medicalCaseId") REFERENCES "MedicalCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalFollowUp" ADD CONSTRAINT "MedicalFollowUp_procedureId_fkey" FOREIGN KEY ("procedureId") REFERENCES "Procedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalFollowUp" ADD CONSTRAINT "MedicalFollowUp_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicalFollowUp" ADD CONSTRAINT "MedicalFollowUp_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
