-- DropIndex
DROP INDEX "Job_sourceUrl_key";

-- AlterTable
ALTER TABLE "OfferComparison" ADD COLUMN     "applicationId" TEXT;

-- CreateIndex
CREATE INDEX "First90DaysTracker_applicationId_idx" ON "First90DaysTracker"("applicationId");

-- CreateIndex
CREATE INDEX "OfferComparison_applicationId_idx" ON "OfferComparison"("applicationId");

-- AddForeignKey
ALTER TABLE "OfferComparison" ADD CONSTRAINT "OfferComparison_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "First90DaysTracker" ADD CONSTRAINT "First90DaysTracker_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
