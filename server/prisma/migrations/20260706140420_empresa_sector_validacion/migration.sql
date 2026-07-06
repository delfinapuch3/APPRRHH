/*
  Warnings:

  - You are about to drop the `Obra` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserObra` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `obraId` on the `Employee` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "UserObra_userId_obraId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Obra";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "UserObra";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "empresaId" TEXT,
    CONSTRAINT "Sector_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserSector" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,
    CONSTRAINT "UserSector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserSector_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DailyCalculation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "tipoDia" TEXT NOT NULL,
    "horasNormales" REAL NOT NULL DEFAULT 0,
    "horasExtra50" REAL NOT NULL DEFAULT 0,
    "horasExtra100" REAL NOT NULL DEFAULT 0,
    "francoGenerado" BOOLEAN NOT NULL DEFAULT false,
    "ausente" BOOLEAN NOT NULL DEFAULT false,
    "justificada" BOOLEAN,
    "tipoAusencia" TEXT,
    "observaciones" TEXT,
    "extrasValidadas" BOOLEAN NOT NULL DEFAULT false,
    "validadoPorId" TEXT,
    "fechaValidacion" DATETIME,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyCalculation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyCalculation_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DailyCalculation" ("ausente", "employeeId", "fecha", "francoGenerado", "horasExtra100", "horasExtra50", "horasNormales", "id", "justificada", "observaciones", "tipoAusencia", "tipoDia", "updatedAt") SELECT "ausente", "employeeId", "fecha", "francoGenerado", "horasExtra100", "horasExtra50", "horasNormales", "id", "justificada", "observaciones", "tipoAusencia", "tipoDia", "updatedAt" FROM "DailyCalculation";
DROP TABLE "DailyCalculation";
ALTER TABLE "new_DailyCalculation" RENAME TO "DailyCalculation";
CREATE INDEX "DailyCalculation_fecha_idx" ON "DailyCalculation"("fecha");
CREATE UNIQUE INDEX "DailyCalculation_employeeId_fecha_key" ON "DailyCalculation"("employeeId", "fecha");
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legajo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "sindicato" TEXT,
    "fechaIngreso" DATETIME NOT NULL,
    "valorHoraNormal" REAL NOT NULL,
    "horasTeoricasDiarias" REAL NOT NULL DEFAULT 8,
    "sectorId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "escalaVacacionesOverride" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("activo", "apellido", "createdAt", "escalaVacacionesOverride", "fechaIngreso", "id", "legajo", "nombre", "sindicato", "valorHoraNormal") SELECT "activo", "apellido", "createdAt", "escalaVacacionesOverride", "fechaIngreso", "id", "legajo", "nombre", "sindicato", "valorHoraNormal" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_legajo_key" ON "Employee"("legajo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_nombre_key" ON "Empresa"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "UserSector_userId_sectorId_key" ON "UserSector"("userId", "sectorId");
