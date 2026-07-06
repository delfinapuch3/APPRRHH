-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'ENCARGADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Obra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserObra" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "obraId" TEXT NOT NULL,
    CONSTRAINT "UserObra_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserObra_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "legajo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "fechaIngreso" DATETIME NOT NULL,
    "valorHoraNormal" REAL NOT NULL,
    "obraId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "escalaVacacionesOverride" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Employee_obraId_fkey" FOREIGN KEY ("obraId") REFERENCES "Obra" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TimeRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "fecha" DATETIME NOT NULL,
    "horaEntrada" DATETIME NOT NULL,
    "horaSalida" DATETIME,
    "origen" TEXT NOT NULL DEFAULT 'MANUAL',
    "importBatchId" TEXT,
    "observaciones" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TimeRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TimeRecord_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nombreArchivo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cantidadRegistros" INTEGER NOT NULL DEFAULT 0,
    "cantidadErrores" INTEGER NOT NULL DEFAULT 0,
    "logDetalle" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportBatch_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fecha" DATETIME NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'NACIONAL'
);

-- CreateTable
CREATE TABLE "PayrollConfig" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "horasNormalesPorDia" REAL NOT NULL DEFAULT 8,
    "horaCorteSabado" TEXT NOT NULL DEFAULT '12:00',
    "multiplicadorExtra50" REAL NOT NULL DEFAULT 1.5,
    "multiplicadorExtra100" REAL NOT NULL DEFAULT 2.0,
    "horasFrancoCompensatorio" REAL NOT NULL DEFAULT 8,
    "feriadoComoDomingo" BOOLEAN NOT NULL DEFAULT true,
    "escalaVacaciones" TEXT NOT NULL DEFAULT '[{"hastaAnios":5,"dias":14},{"hastaAnios":10,"dias":21},{"hastaAnios":20,"dias":28},{"hastaAnios":999,"dias":35}]'
);

-- CreateTable
CREATE TABLE "DailyCalculation" (
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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DailyCalculation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "fechaDesde" DATETIME NOT NULL,
    "fechaHasta" DATETIME NOT NULL,
    "tipo" TEXT NOT NULL,
    "justificada" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "cargadoPorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Absence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Absence_cargadoPorId_fkey" FOREIGN KEY ("cargadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VacationPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "anioCorrespondiente" INTEGER NOT NULL,
    "fechaDesde" DATETIME NOT NULL,
    "fechaHasta" DATETIME NOT NULL,
    "diasTomados" INTEGER NOT NULL,
    "observaciones" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VacationPeriod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FrancoCompensatorio" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "fechaGenerado" DATETIME NOT NULL,
    "horas" REAL NOT NULL DEFAULT 8,
    "estado" TEXT NOT NULL DEFAULT 'PENDIENTE',
    "fechaTomado" DATETIME,
    "liquidacionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FrancoCompensatorio_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FrancoCompensatorio_liquidacionId_fkey" FOREIGN KEY ("liquidacionId") REFERENCES "PayrollPeriod" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "employeeId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "fechaDesde" DATETIME NOT NULL,
    "fechaHasta" DATETIME NOT NULL,
    "horasNormales" REAL NOT NULL DEFAULT 0,
    "horasExtra50" REAL NOT NULL DEFAULT 0,
    "horasExtra100" REAL NOT NULL DEFAULT 0,
    "cantidadFrancosPagados" INTEGER NOT NULL DEFAULT 0,
    "montoNormal" REAL NOT NULL DEFAULT 0,
    "montoExtra50" REAL NOT NULL DEFAULT 0,
    "montoExtra100" REAL NOT NULL DEFAULT 0,
    "montoFrancos" REAL NOT NULL DEFAULT 0,
    "totalBruto" REAL NOT NULL DEFAULT 0,
    "estado" TEXT NOT NULL DEFAULT 'BORRADOR',
    "generadoPorId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PayrollPeriod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PayrollPeriod_generadoPorId_fkey" FOREIGN KEY ("generadoPorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "UserObra_userId_obraId_key" ON "UserObra"("userId", "obraId");

-- CreateIndex
CREATE UNIQUE INDEX "Employee_legajo_key" ON "Employee"("legajo");

-- CreateIndex
CREATE INDEX "TimeRecord_employeeId_fecha_idx" ON "TimeRecord"("employeeId", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_fecha_key" ON "Holiday"("fecha");

-- CreateIndex
CREATE INDEX "DailyCalculation_fecha_idx" ON "DailyCalculation"("fecha");

-- CreateIndex
CREATE UNIQUE INDEX "DailyCalculation_employeeId_fecha_key" ON "DailyCalculation"("employeeId", "fecha");
