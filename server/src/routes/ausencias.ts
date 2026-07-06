import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { obraScope } from "../middleware/auth.js";
import { recalcularEmpleadoPeriodo } from "../engine/recalcular.js";

const router = Router();

router.get("/", async (req, res) => {
  const scope = obraScope(req);
  const { employeeId } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (scope) where.employee = { obraId: { in: scope } };
  const ausencias = await prisma.absence.findMany({
    where,
    include: { employee: true, cargadoPor: { select: { nombre: true } } },
    orderBy: { fechaDesde: "desc" },
  });
  res.json(ausencias);
});

const TIPOS = [
  "ENFERMEDAD",
  "LICENCIA_GREMIAL",
  "LICENCIA_MATERNIDAD",
  "LICENCIA_ESTUDIO",
  "FALLECIMIENTO_FAMILIAR",
  "ACCIDENTE_TRABAJO",
  "INJUSTIFICADA",
  "OTRA",
] as const;

const ausenciaSchema = z.object({
  employeeId: z.string().min(1),
  fechaDesde: z.coerce.date(),
  fechaHasta: z.coerce.date(),
  tipo: z.enum(TIPOS),
  justificada: z.boolean(),
  observaciones: z.string().optional(),
});

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
  const parsed = ausenciaSchema.partial().safeParse(req.body);
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
