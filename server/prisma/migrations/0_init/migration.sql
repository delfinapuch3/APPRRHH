-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'ENCARGADO');

-- CreateEnum
CREATE TYPE "OrigenFichada" AS ENUM ('IMPORTADO', 'MANUAL');

-- CreateEnum
CREATE TYPE "TipoDia" AS ENUM ('HABIL', 'SABADO', 'DOMINGO', 'FERIADO');

-- CreateEnum
CREATE TYPE "TipoAusencia" AS ENUM ('LICENCIA_ART', 'VACACIONES', 'LICENCIA_GREMIAL', 'PERMISO_PERSONAL', 'ENFERMEDAD_ACCIDENTE_INCULPABLE', 'LICENCIA_SIN_GOCE_SUELDO', 'SUSPENSION', 'FALLECIMIENTO_FAMILIAR', 'EXAMEN_ESTUDIO', 'TARDANZA', 'INJUSTIFICADA', 'OTRA');

-- CreateEnum
CREATE TYPE "EstadoFranco" AS ENUM ('PENDIENTE', 'TOMADO');

-- CreateEnum
CREATE TYPE "TipoLiquidacion" AS ENUM ('QUINCENAL', 'MENSUAL');

-- CreateEnum
CREATE TYPE "EstadoLiquidacion" AS ENUM ('BORRADOR', 'CERRADA');

-- CreateEnum
CREATE TYPE "TipoFeriado" AS ENUM ('NACIONAL', 'PROVINCIAL', 'PUENTE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL DEFAULT '',
    "role" "Role" NOT NULL DEFAULT 'ENCARGADO',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empresa" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Empresa_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sector" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSector" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sectorId" TEXT NOT NULL,

    CONSTRAINT "UserSector_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "legajo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "sindicato" TEXT,
    "fechaNacimiento" TIMESTAMP(3),
    "genero" TEXT,
    "fechaIngreso" TIMESTAMP(3) NOT NULL,
    "valorHoraNormal" DOUBLE PRECISION NOT NULL,
    "horasTeoricasDiarias" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "empresaId" TEXT NOT NULL,
    "sectorId" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "escalaVacacionesOverride" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Jornada" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "horaInicio" TEXT NOT NULL,
    "horaFin" TEXT NOT NULL,
    "toleranciaMinutos" INTEGER NOT NULL DEFAULT 15,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Jornada_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimeRecord" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "horaEntrada" TIMESTAMP(3) NOT NULL,
    "horaSalida" TIMESTAMP(3),
    "origen" "OrigenFichada" NOT NULL DEFAULT 'MANUAL',
    "importBatchId" TEXT,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimeRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "nombreArchivo" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "cantidadRegistros" INTEGER NOT NULL DEFAULT 0,
    "cantidadErrores" INTEGER NOT NULL DEFAULT 0,
    "logDetalle" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Holiday" (
    "id" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "nombre" TEXT NOT NULL,
    "tipo" "TipoFeriado" NOT NULL DEFAULT 'NACIONAL',

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollConfig" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "horasNormalesPorDia" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "horaCorteSabado" TEXT NOT NULL DEFAULT '12:00',
    "multiplicadorExtra50" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "multiplicadorExtra100" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "horasFrancoCompensatorio" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "feriadoComoDomingo" BOOLEAN NOT NULL DEFAULT true,
    "escalaVacaciones" TEXT NOT NULL DEFAULT '[{"hastaAnios":5,"dias":14},{"hastaAnios":10,"dias":21},{"hastaAnios":20,"dias":28},{"hastaAnios":999,"dias":35}]',

    CONSTRAINT "PayrollConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyCalculation" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL,
    "tipoDia" "TipoDia" NOT NULL,
    "horasNormales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "horasExtra50" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "horasExtra100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "francoGenerado" BOOLEAN NOT NULL DEFAULT false,
    "ausente" BOOLEAN NOT NULL DEFAULT false,
    "justificada" BOOLEAN,
    "tipoAusencia" "TipoAusencia",
    "observaciones" TEXT,
    "extrasValidadas" BOOLEAN NOT NULL DEFAULT false,
    "validadoPorId" TEXT,
    "fechaValidacion" TIMESTAMP(3),
    "horasManual" BOOLEAN NOT NULL DEFAULT false,
    "tarde" BOOLEAN NOT NULL DEFAULT false,
    "retiroAnticipado" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Absence" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3) NOT NULL,
    "tipo" "TipoAusencia" NOT NULL,
    "justificada" BOOLEAN NOT NULL DEFAULT true,
    "observaciones" TEXT,
    "cargadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacationPeriod" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "anioCorrespondiente" INTEGER NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3) NOT NULL,
    "diasTomados" INTEGER NOT NULL,
    "observaciones" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VacationPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FrancoCompensatorio" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "fechaGenerado" TIMESTAMP(3) NOT NULL,
    "horas" DOUBLE PRECISION NOT NULL DEFAULT 8,
    "estado" "EstadoFranco" NOT NULL DEFAULT 'PENDIENTE',
    "fechaTomado" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FrancoCompensatorio_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "tipo" "TipoLiquidacion" NOT NULL,
    "fechaDesde" TIMESTAMP(3) NOT NULL,
    "fechaHasta" TIMESTAMP(3) NOT NULL,
    "horasNormales" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "horasExtra50" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "horasExtra100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoNormal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoExtra50" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "montoExtra100" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalBruto" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "estado" "EstadoLiquidacion" NOT NULL DEFAULT 'BORRADOR',
    "generadoPorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Empresa_nombre_key" ON "Empresa"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "Sector_nombre_key" ON "Sector"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "UserSector_userId_sectorId_key" ON "UserSector"("userId", "sectorId");

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

-- AddForeignKey
ALTER TABLE "UserSector" ADD CONSTRAINT "UserSector_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSector" ADD CONSTRAINT "UserSector_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_empresaId_fkey" FOREIGN KEY ("empresaId") REFERENCES "Empresa"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_sectorId_fkey" FOREIGN KEY ("sectorId") REFERENCES "Sector"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeRecord" ADD CONSTRAINT "TimeRecord_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeRecord" ADD CONSTRAINT "TimeRecord_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCalculation" ADD CONSTRAINT "DailyCalculation_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCalculation" ADD CONSTRAINT "DailyCalculation_validadoPorId_fkey" FOREIGN KEY ("validadoPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Absence" ADD CONSTRAINT "Absence_cargadoPorId_fkey" FOREIGN KEY ("cargadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationPeriod" ADD CONSTRAINT "VacationPeriod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrancoCompensatorio" ADD CONSTRAINT "FrancoCompensatorio_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_generadoPorId_fkey" FOREIGN KEY ("generadoPorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

