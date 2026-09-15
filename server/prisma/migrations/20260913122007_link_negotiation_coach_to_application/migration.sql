-- CreateIndex
CREATE INDEX "NegotiationCoach_applicationId_idx" ON "NegotiationCoach"("applicationId");

-- AddForeignKey
ALTER TABLE "NegotiationCoach" ADD CONSTRAINT "NegotiationCoach_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "JobApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;
