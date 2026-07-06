import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { sectorScope } from "../middleware/auth.js";
import { recalcularEmpleadoPeriodo } from "../engine/recalcular.js";

const router = Router();

router.get("/", async (req, res) => {
  const scope = sectorScope(req);
  const { employeeId } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (scope) where.employee = { sectorId: { in: scope } };
  const ausencias = await prisma.absence.findMany({
    where,
    include: { employee: true, cargadoPor: { select: { nombre: true } } },
    orderBy: { fechaDesde: "desc" },
  });
  res.json(ausencias);
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
});

const ausenciaSchema = ausenciaBaseSchema.refine(
  (data) => data.tipo !== "OTRA" || (data.observaciones?.trim().length ?? 0) > 0,
  { message: "Para el tipo 'Otra' hay que aclarar el motivo en observaciones", path: ["observaciones"] }
);

router.post("/", async (req, res) => {
  const parsed = ausenciaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const ausencia = await prisma.absence.create({
    data: { ...parsed.data, cargadoPorId: req.user!.id },
  });
  await recalcularEmpleadoPeriodo(ausencia.employeeId, ausencia.fechaDesde, ausencia.fechaHasta);
  res.status(201).json(ausencia);
});

router.put("/:id", async (req, res) => {
  const parsed = ausenciaBaseSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const ausencia = await prisma.absence.update({ where: { id: req.params.id }, data: parsed.data });
  await recalcularEmpleadoPeriodo(ausencia.employeeId, ausencia.fechaDesde, ausencia.fechaHasta);
  res.json(ausencia);
});

router.delete("/:id", async (req, res) => {
  const ausencia = await prisma.absence.delete({ where: { id: req.params.id } });
  await recalcularEmpleadoPeriodo(ausencia.employeeId, ausencia.fechaDesde, ausencia.fechaHasta);
  res.status(204).end();
});

export default router;
