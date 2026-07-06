import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { obraScope } from "../middleware/auth.js";
import { diasCorrespondientes, type TramoVacaciones } from "../engine/vacaciones.js";

const router = Router();

router.get("/:employeeId/balance", async (req, res) => {
  const anio = req.query.anio ? Number(req.query.anio) : new Date().getFullYear();
  const empleado = await prisma.employee.findUnique({ where: { id: req.params.employeeId } });
  if (!empleado) return res.status(404).json({ error: "No encontrado" });

  const config = await prisma.payrollConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  const escala: TramoVacaciones[] = empleado.escalaVacacionesOverride
    ? JSON.parse(empleado.escalaVacacionesOverride)
    : JSON.parse(config.escalaVacaciones);

  const correspondientes = diasCorrespondientes(empleado.fechaIngreso, anio, escala);
  const periodos = await prisma.vacationPeriod.findMany({
    where: { employeeId: empleado.id, anioCorrespondiente: anio },
    orderBy: { fechaDesde: "asc" },
  });
  const tomados = periodos.reduce((acc, p) => acc + p.diasTomados, 0);

  res.json({ anio, correspondientes, tomados, restantes: correspondientes - tomados, periodos });
});

router.get("/", async (req, res) => {
  const scope = obraScope(req);
  const { employeeId } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (scope) where.employee = { obraId: { in: scope } };
  const periodos = await prisma.vacationPeriod.findMany({
    where,
    include: { employee: true },
    orderBy: { fechaDesde: "desc" },
  });
  res.json(periodos);
});

const vacacionSchema = z.object({
  employeeId: z.string().min(1),
  anioCorrespondiente: z.number().int(),
  fechaDesde: z.coerce.date(),
  fechaHasta: z.coerce.date(),
  diasTomados: z.number().int().positive(),
  observaciones: z.string().optional(),
});

router.post("/", async (req, res) => {
  const parsed = vacacionSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const periodo = await prisma.vacationPeriod.create({ data: parsed.data });
  res.status(201).json(periodo);
});

router.put("/:id", async (req, res) => {
  const parsed = vacacionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const periodo = await prisma.vacationPeriod.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(periodo);
});

router.delete("/:id", async (req, res) => {
  await prisma.vacationPeriod.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
