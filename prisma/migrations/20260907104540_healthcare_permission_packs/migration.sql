-- CreateEnum
CREATE TYPE "PermissionPack" AS ENUM ('HEALTHCARE_RECEPTION', 'HEALTHCARE_NURSE', 'HEALTHCARE_DOCTOR', 'HEALTHCARE_CARE');

-- CreateTable
CREATE TABLE "CompanyMembershipPack" (
    "id" TEXT NOT NULL,
    "membershipId" TEXT NOT NULL,
    "pack" "PermissionPack" NOT NULL,
    "grantedByUserId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyMembershipPack_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CompanyMembershipPack_membershipId_idx" ON "CompanyMembershipPack"("membershipId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyMembershipPack_membershipId_pack_key" ON "CompanyMembershipPack"("membershipId", "pack");

-- AddForeignKey
ALTER TABLE "CompanyMembershipPack" ADD CONSTRAINT "CompanyMembershipPack_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "CompanyMembership"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyMembershipPack" ADD CONSTRAINT "CompanyMembershipPack_grantedByUserId_fkey" FOREIGN KEY ("grantedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
