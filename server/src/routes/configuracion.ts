import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", async (_req, res) => {
  const config = await prisma.payrollConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  res.json({ ...config, escalaVacaciones: JSON.parse(config.escalaVacaciones) });
});

const configSchema = z.object({
  horasNormalesPorDia: z.number().positive().optional(),
  horaCorteSabado: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  multiplicadorExtra50: z.number().positive().optional(),
  multiplicadorExtra100: z.number().positive().optional(),
  horasFrancoCompensatorio: z.number().positive().optional(),
  feriadoComoDomingo: z.boolean().optional(),
  escalaVacaciones: z.array(z.object({ hastaAnios: z.number(), dias: z.number() })).optional(),
});

router.put("/", requireAdmin, async (req, res) => {
  const parsed = configSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { escalaVacaciones, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (escalaVacaciones) data.escalaVacaciones = JSON.stringify(escalaVacaciones);
  const config = await prisma.payrollConfig.upsert({
    where: { id: 1 },
    update: data,
    create: { id: 1, ...data },
  });
  res.json({ ...config, escalaVacaciones: JSON.parse(config.escalaVacaciones) });
});

router.get("/feriados", async (_req, res) => {
  const feriados = await prisma.holiday.findMany({ orderBy: { fecha: "asc" } });
  res.json(feriados);
});

const feriadoSchema = z.object({
  fecha: z.coerce.date(),
  nombre: z.string().min(1),
  tipo: z.enum(["NACIONAL", "PROVINCIAL", "PUENTE"]).optional(),
});

router.post("/feriados", requireAdmin, async (req, res) => {
  const parsed = feriadoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const feriado = await prisma.holiday.create({ data: parsed.data });
  res.status(201).json(feriado);
});

router.delete("/feriados/:id", requireAdmin, async (req, res) => {
  await prisma.holiday.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
