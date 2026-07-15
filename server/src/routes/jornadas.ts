import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", async (_req, res) => {
  const jornadas = await prisma.jornada.findMany({ orderBy: { nombre: "asc" } });
  res.json(jornadas);
});

const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
const jornadaSchema = z.object({
  nombre: z.string().min(1),
  horaInicio: z.string().regex(horaRegex),
  horaFin: z.string().regex(horaRegex),
  toleranciaMinutos: z.number().int().min(0).max(120),
  activo: z.boolean().optional(),
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = jornadaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const jornada = await prisma.jornada.create({ data: parsed.data });
  res.status(201).json(jornada);
});

router.put("/:id", requireAdmin, async (req, res) => {
  const parsed = jornadaSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const jornada = await prisma.jornada.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(jornada);
});

router.delete("/:id", requireAdmin, async (req, res) => {
  await prisma.jornada.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

export default router;
