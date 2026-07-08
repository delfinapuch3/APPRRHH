-- CreateTable
CREATE TABLE "Jornada" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "redondeoMinutos" INTEGER NOT NULL DEFAULT 0,
    "toleranciaMinutos" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
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
    "horasManual" BOOLEAN NOT NULL DEFAULT false,
    "tarde" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyCalculation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyCalculation_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DailyCalculation" ("ausente", "employeeId", "extrasValidadas", "fecha", "fechaValidacion", "francoGenerado", "horasExtra100", "horasExtra50", "horasManual", "horasNormales", "id", "justificada", "observaciones", "tipoAusencia", "tipoDia", "updatedAt", "validadoPorId") SELECT "ausente", "employeeId", "extrasValidadas", "fecha", "fechaValidacion", "francoGenerado", "horasExtra100", "horasExtra50", "horasManual", "horasNormales", "id", "justificada", "observaciones", "tipoAusencia", "tipoDia", "updatedAt", "validadoPorId" FROM "DailyCalculation";
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
    "jornadaId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "escalaVacacionesOverride" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Employee_jornadaId_fkey" FOREIGN KEY ("jornadaId") REFERENCES "Jornada" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Employee" ("activo", "apellido", "createdAt", "escalaVacacionesOverride", "fechaIngreso", "horasTeoricasDiarias", "id", "legajo", "nombre", "sectorId", "sindicato", "valorHoraNormal") SELECT "activo", "apellido", "createdAt", "escalaVacacionesOverride", "fechaIngreso", "horasTeoricasDiarias", "id", "legajo", "nombre", "sectorId", "sindicato", "valorHoraNormal" FROM "Employee";
DROP TABLE "Employee";
ALTER TABLE "new_Employee" RENAME TO "Employee";
CREATE UNIQUE INDEX "Employee_legajo_key" ON "Employee"("legajo");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'ENCARGADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("activo", "createdAt", "email", "id", "nombre", "passwordHash", "role") SELECT "activo", "createdAt", "email", "id", "nombre", "passwordHash", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

