import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { sectorScope } from "../middleware/auth.js";
import { recalcularEmpleadoPeriodo } from "../engine/recalcular.js";
import { sendXlsx } from "../lib/xlsxExport.js";

const router = Router();

const LABELS_TIPO: Record<string, string> = {
  LICENCIA_ART: "Licencia por ART",
  VACACIONES: "Vacaciones",
  LICENCIA_GREMIAL: "Licencia gremial",
  PERMISO_PERSONAL: "Permiso personal",
  ENFERMEDAD_ACCIDENTE_INCULPABLE: "Enfermedad/accidente inculpable",
  LICENCIA_SIN_GOCE_SUELDO: "Licencia sin goce de sueldo",
  SUSPENSION: "Suspensión",
  FALLECIMIENTO_FAMILIAR: "Fallecimiento de familiar",
  EXAMEN_ESTUDIO: "Examen/estudio",
  TARDANZA: "Tardanza",
  INJUSTIFICADA: "Ausencia injustificada",
  OTRA: "Otra",
};

function buildWhere(req: import("express").Request) {
  const scope = sectorScope(req);
  const { employeeId, desde, hasta, justificada, excluirTipo } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (desde || hasta) {
    where.fechaDesde = { ...(hasta ? { lte: new Date(hasta) } : {}) };
    where.fechaHasta = { ...(desde ? { gte: new Date(desde) } : {}) };
  }
  if (justificada === "true") where.justificada = true;
  if (justificada === "false") where.justificada = false;
  if (excluirTipo) where.tipo = { not: excluirTipo };
  if (scope) where.employee = { sectorId: { in: scope } };
  return where;
}

router.get("/", async (req, res) => {
  const ausencias = await prisma.absence.findMany({
    where: buildWhere(req),
    include: { employee: true, cargadoPor: { select: { nombre: true } }, vacationPeriod: true },
    orderBy: { fechaDesde: "desc" },
  });
  res.json(ausencias);
});

router.get("/export.xlsx", async (req, res) => {
  const ausencias = await prisma.absence.findMany({
    where: buildWhere(req),
    include: { employee: true, cargadoPor: { select: { nombre: true } } },
    orderBy: { fechaDesde: "desc" },
  });
  const rows = [
    ["Legajo", "Empleado", "Desde", "Hasta", "Tipo", "Justificada", "Observaciones", "Cargado por"],
    ...ausencias.map((a) => [
      a.employee.legajo,
      `${a.employee.apellido}, ${a.employee.nombre}`,
      a.fechaDesde.toLocaleDateString("es-AR", { timeZone: "UTC" }),
      a.fechaHasta.toLocaleDateString("es-AR", { timeZone: "UTC" }),
      LABELS_TIPO[a.tipo] ?? a.tipo,
      a.justificada ? "Sí" : "No",
      a.observaciones ?? "",
      a.cargadoPor.nombre,
    ]),
  ];
  sendXlsx(res, "ausencias.xlsx", "Ausencias", rows);
});

const TIPOS = [
  "LICENCIA_ART",
  "VACACIONES",
  "LICENCIA_GREMIAL",
  "PERMISO_PERSONAL",
  "ENFERMEDAD_ACCIDENTE_INCULPABLE",
  "LICENCIA_SIN_GOCE_SUELDO",
  "SUSPENSION",
  "FALLECIMIENTO_FAMILIAR",
  "EXAMEN_ESTUDIO",
  "TARDANZA",
  "INJUSTIFICADA",
  "OTRA",
] as const;

const ausenciaBaseSchema = z.object({
  employeeId: z.string().min(1),
  fechaDesde: z.coerce.date(),
  fechaHasta: z.coerce.date(),
  tipo: z.enum(TIPOS),
  justificada: z.boolean(),
  observaciones: z.string().optional(),
  // Solo aplica cuando tipo === "VACACIONES" y justificada === true: a qué
  // año se le descuentan estos días (puede ser un año anterior, ej.
  // vacaciones pendientes/adeudadas de 2025 tomadas en 2026).
  anioCorrespondiente: z.number().int().optional(),
});

const ausenciaSchema = ausenciaBaseSchema
  .refine((data) => data.tipo !== "OTRA" || (data.observaciones?.trim().length ?? 0) > 0, {
    message: "Para el tipo 'Otra' hay que aclarar el motivo en observaciones",
    path: ["observaciones"],
  })
  .refine((data) => data.tipo !== "VACACIONES" || !data.justificada || data.anioCorrespondiente != null, {
    message: "Para Vacaciones hay que indicar a qué año corresponden los días",
    path: ["anioCorrespondiente"],
  });

function diasEntre(desde: Date, hasta: Date): number {
  return Math.round((hasta.getTime() - desde.getTime()) / 86_400_000) + 1;
}

/**
 * Mantiene sincronizado el VacationPeriod vinculado a una ausencia tipo
 * "Vacaciones": lo crea, actualiza o borra según corresponda, para que el
 * Historial de vacaciones y el balance por año reflejen lo que se carga
 * desde el formulario de Ausencias sin que RRHH tenga que cargarlo dos veces.
 */
async function sincronizarPeriodoVacaciones(
  ausencia: { id: string; employeeId: string; tipo: string; justificada: boolean; fechaDesde: Date; fechaHasta: Date; observaciones: string | null },
  anioCorrespondienteBody: number | undefined
) {
  const periodoExistente = await prisma.vacationPeriod.findUnique({ where: { absenceId: ausencia.id } });
  // En una edición parcial que no toca el año, se conserva el año que ya
  // tenía el período vinculado en vez de asumir que se quiere desvincular.
  const anioCorrespondiente = anioCorrespondienteBody ?? periodoExistente?.anioCorrespondiente;
  const corresponde = ausencia.tipo === "VACACIONES" && ausencia.justificada && anioCorrespondiente != null;

  if (!corresponde) {
    if (periodoExistente) await prisma.vacationPeriod.delete({ where: { id: periodoExistente.id } });
    return;
  }

  const data = {
    employeeId: ausencia.employeeId,
    anioCorrespondiente: anioCorrespondiente!,
    fechaDesde: ausencia.fechaDesde,
    fechaHasta: ausencia.fechaHasta,
    diasTomados: diasEntre(ausencia.fechaDesde, ausencia.fechaHasta),
    observaciones: ausencia.observaciones,
  };
  if (periodoExistente) {
    await prisma.vacationPeriod.update({ where: { id: periodoExistente.id }, data });
  } else {
    await prisma.vacationPeriod.create({ data: { ...data, absenceId: ausencia.id } });
  }
}

router.post("/", async (req, res) => {
  const parsed = ausenciaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { anioCorrespondiente, ...data } = parsed.data;
  const ausencia = await prisma.absence.create({
    data: { ...data, cargadoPorId: req.user!.id },
  });
  await sincronizarPeriodoVacaciones(ausencia, anioCorrespondiente);
  await recalcularEmpleadoPeriodo(ausencia.employeeId, ausencia.fechaDesde, ausencia.fechaHasta);
  res.status(201).json(ausencia);
});

router.put("/:id", async (req, res) => {
  const parsed = ausenciaBaseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { anioCorrespondiente, ...data } = parsed.data;
  const ausencia = await prisma.absence.update({ where: { id: req.params.id }, data });
  await sincronizarPeriodoVacaciones(ausencia, anioCorrespondiente);
  await recalcularEmpleadoPeriodo(ausencia.employeeId, ausencia.fechaDesde, ausencia.fechaHasta);
  res.json(ausencia);
});

router.delete("/:id", async (req, res) => {
  const ausencia = await prisma.absence.delete({ where: { id: req.params.id } });
  await recalcularEmpleadoPeriodo(ausencia.employeeId, ausencia.fechaDesde, ausencia.fechaHasta);
  res.status(204).end();
});

export default router;
