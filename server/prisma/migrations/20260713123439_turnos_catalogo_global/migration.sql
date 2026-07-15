/*
  Warnings:

  - You are about to drop the column `jornadaId` on the `Employee` table. All the data in the column will be lost.
  - You are about to drop the column `redondeoMinutos` on the `Jornada` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legajo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "sindicato" TEXT,
    "fechaNacimiento" DATETIME,
    "genero" TEXT,
    "fechaIngreso" DATETIME NOT NULL,
    "valorHoraNormal" REAL NOT NULL,
    "horasTeoricasDiarias" REAL NOT NULL DEFAULT 8,
    "empresaId" TEXT NOT NULL,
    "sectorId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "escalaVacacionesOverride" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Employee_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("activo", "apellido", "createdAt", "empresaId", "escalaVacacionesOverride", "fechaIngreso", "fechaNacimiento", "genero", "horasTeoricasDiarias", "id", "legajo", "nombre", "sectorId", "sindicato", "valorHoraNormal") SELECT "activo", "apellido", "createdAt", "empresaId", "escalaVacacionesOverride", "fechaIngreso", "fechaNacimiento", "genero", "horasTeoricasDiarias", "id", "legajo", "nombre", "sectorId", "sindicato", "valorHoraNormal" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_legajo_key" ON "Employee"("legajo");
CREATE TABLE "new_Jornada" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "toleranciaMinutos" INTEGER NOT NULL DEFAULT 15,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Jornada" ("activo", "createdAt", "horaFin", "horaInicio", "id", "nombre", "toleranciaMinutos") SELECT "activo", "createdAt", "horaFin", "horaInicio", "id", "nombre", "toleranciaMinutos" FROM "Jornada";
DROP TABLE "Jornada";
ALTER TABLE "new_Jornada" RENAME TO "Jornada";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
