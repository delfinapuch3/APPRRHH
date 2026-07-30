-- AlterTable
ALTER TABLE "VacationPeriod" ADD COLUMN "absenceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "VacationPeriod_absenceId_key" ON "VacationPeriod"("absenceId");

-- AddForeignKey
ALTER TABLE "VacationPeriod" ADD CONSTRAINT "VacationPeriod_absenceId_fkey" FOREIGN KEY ("absenceId") REFERENCES "Absence"("id") ON DELETE CASCADE ON UPDATE CASCADE;
