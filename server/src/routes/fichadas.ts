import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { sectorScope } from "../middleware/auth.js";
import { recalcularEmpleadoPeriodo } from "../engine/recalcular.js";

const router = Router();

router.get("/", async (req, res) => {
  const scope = sectorScope(req);
  const { employeeId, desde, hasta } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (desde || hasta) {
    where.fecha = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }
  if (scope) {
    where.employee = { sectorId: { in: scope } };
  }
  const fichadas = await prisma.timeRecord.findMany({
    where,
    include: { employee: true },
    orderBy: { fecha: "desc" },
    take: 500,
  });
  res.json(fichadas);
});

const fichadaSchema = z.object({
  employeeId: z.string().min(1),
  fecha: z.coerce.date(),
  horaEntrada: z.coerce.date(),
  horaSalida: z.coerce.date().nullable().optional(),
  observaciones: z.string().optional(),
});

router.post("/", async (req, res) => {
  const parsed = fichadaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const fichada = await prisma.timeRecord.create({
    data: { ...parsed.data, origen: "MANUAL" },
  });
  await recalcularEmpleadoPeriodo(fichada.employeeId, fichada.fecha, fichada.fecha);
  res.status(201).json(fichada);
});

router.put("/:id", async (req, res) => {
  const parsed = fichadaSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const fichada = await prisma.timeRecord.update({ where: { id: req.params.id }, data: parsed.data });
  await recalcularEmpleadoPeriodo(fichada.employeeId, fichada.fecha, fichada.fecha);
  res.json(fichada);
});

router.delete("/:id", async (req, res) => {
  const fichada = await prisma.timeRecord.delete({ where: { id: req.params.id } });
  await recalcularEmpleadoPeriodo(fichada.employeeId, fichada.fecha, fichada.fecha);
  res.status(204).end();
});

export default router;
