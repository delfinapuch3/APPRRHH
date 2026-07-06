import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", async (_req, res) => {
  const empresas = await prisma.empresa.findMany({ orderBy: { nombre: "asc" } });
  res.json(empresas);
});

const empresaSchema = z.object({
  nombre: z.string().min(1),
  activo: z.boolean().optional(),
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = empresaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const empresa = await prisma.empresa.create({ data: parsed.data });
  res.status(201).json(empresa);
});

router.put("/:id", requireAdmin, async (req, res) => {
  const parsed = empresaSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const empresa = await prisma.empresa.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(empresa);
});

export default router;
