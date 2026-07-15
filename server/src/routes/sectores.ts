import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", async (_req, res) => {
  const sectores = await prisma.sector.findMany({ orderBy: { nombre: "asc" } });
  res.json(sectores);
});

const sectorSchema = z.object({
  nombre: z.string().min(1),
  activo: z.boolean().optional(),
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = sectorSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const existente = await prisma.sector.findFirst({ where: { nombre: parsed.data.nombre } });
  if (existente) return res.status(409).json({ error: `Ya existe un sector llamado "${parsed.data.nombre}"` });
  const sector = await prisma.sector.create({ data: parsed.data });
  res.status(201).json(sector);
});

router.put("/:id", requireAdmin, async (req, res) => {
  const parsed = sectorSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const sector = await prisma.sector.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(sector);
});

export default router;
