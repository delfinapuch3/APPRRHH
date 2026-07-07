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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyCalculation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DailyCalculation_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_DailyCalculation" ("ausente", "employeeId", "extrasValidadas", "fecha", "fechaValidacion", "francoGenerado", "horasExtra100", "horasExtra50", "horasNormales", "id", "justificada", "observaciones", "tipoAusencia", "tipoDia", "updatedAt", "validadoPorId") SELECT "ausente", "employeeId", "extrasValidadas", "fecha", "fechaValidacion", "francoGenerado", "horasExtra100", "horasExtra50", "horasNormales", "id", "justificada", "observaciones", "tipoAusencia", "tipoDia", "updatedAt", "validadoPorId" FROM "DailyCalculation";
DROP TABLE "DailyCalculation";
ALTER TABLE "new_DailyCalculation" RENAME TO "DailyCalculation";
CREATE INDEX "DailyCalculation_fecha_idx" ON "DailyCalculation"("fecha");
CREATE UNIQUE INDEX "DailyCalculation_employeeId_fecha_key" ON "DailyCalculation"("employeeId", "fecha");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
