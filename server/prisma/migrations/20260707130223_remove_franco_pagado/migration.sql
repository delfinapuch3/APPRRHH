-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FrancoCompensatorio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "fechaGenerado" DATETIME NOT NULL,
    "horas" REAL NOT NULL DEFAULT 8,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaTomado" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FrancoCompensatorio_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_FrancoCompensatorio" ("createdAt", "employeeId", "estado", "fechaGenerado", "fechaTomado", "horas", "id") SELECT "createdAt", "employeeId", "estado", "fechaGenerado", "fechaTomado", "horas", "id" FROM "FrancoCompensatorio";
DROP TABLE "FrancoCompensatorio";
ALTER TABLE "new_FrancoCompensatorio" RENAME TO "FrancoCompensatorio";
CREATE TABLE "new_PayrollPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fechaDesde" DATETIME NOT NULL,
    "fechaHasta" DATETIME NOT NULL,
    "horasNormales" REAL NOT NULL DEFAULT 0,
    "horasExtra50" REAL NOT NULL DEFAULT 0,
    "horasExtra100" REAL NOT NULL DEFAULT 0,
    "montoNormal" REAL NOT NULL DEFAULT 0,
    "montoExtra50" REAL NOT NULL DEFAULT 0,
    "montoExtra100" REAL NOT NULL DEFAULT 0,
    "totalBruto" REAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "generadoPorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollPeriod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollPeriod_generadoPorId_fkey" FOREIGN KEY ("generadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_PayrollPeriod" ("createdAt", "employeeId", "estado", "fechaDesde", "fechaHasta", "generadoPorId", "horasExtra100", "horasExtra50", "horasNormales", "id", "montoExtra100", "montoExtra50", "montoNormal", "tipo", "totalBruto") SELECT "createdAt", "employeeId", "estado", "fechaDesde", "fechaHasta", "generadoPorId", "horasExtra100", "horasExtra50", "horasNormales", "id", "montoExtra100", "montoExtra50", "montoNormal", "tipo", "totalBruto" FROM "PayrollPeriod";
DROP TABLE "PayrollPeriod";
ALTER TABLE "new_PayrollPeriod" RENAME TO "PayrollPeriod";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

