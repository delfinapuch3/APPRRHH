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
    "empresaId" TEXT,
    "sectorId" TEXT,
    "jornadaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "escalaVacacionesOverride" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "Jornada" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("activo", "apellido", "createdAt", "escalaVacacionesOverride", "fechaIngreso", "fechaNacimiento", "genero", "horasTeoricasDiarias", "id", "jornadaId", "legajo", "nombre", "sectorId", "sindicato", "valorHoraNormal") SELECT "activo", "apellido", "createdAt", "escalaVacacionesOverride", "fechaIngreso", "fechaNacimiento", "genero", "horasTeoricasDiarias", "id", "jornadaId", "legajo", "nombre", "sectorId", "sindicato", "valorHoraNormal" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_legajo_key" ON "Employee"("legajo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
