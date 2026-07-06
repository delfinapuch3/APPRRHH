import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { sectorScope } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  const scope = sectorScope(req);
  const { employeeId, estado } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (estado) where.estado = estado;
  if (scope) where.employee = { sectorId: { in: scope } };
  const francos = await prisma.francoCompensatorio.findMany({
    where,
    include: { employee: true },
    orderBy: { fechaGenerado: "desc" },
  });
  res.json(francos);
});

const updateSchema = z.object({
  estado: z.enum(["PENDIENTE", "TOMADO", "PAGADO"]),
  fechaTomado: z.coerce.date().optional(),
});

router.put("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const franco = await prisma.francoCompensatorio.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(franco);
});

export default router;
