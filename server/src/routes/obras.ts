import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", async (_req, res) => {
  const obras = await prisma.obra.findMany({ orderBy: { nombre: "asc" } });
  res.json(obras);
});

const obraSchema = z.object({
  nombre: z.string().min(1),
  activo: z.boolean().optional(),
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = obraSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const obra = await prisma.obra.create({ data: parsed.data });
  res.status(201).json(obra);
});

router.put("/:id", requireAdmin, async (req, res) => {
  const parsed = obraSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const obra = await prisma.obra.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(obra);
});

export default router;
