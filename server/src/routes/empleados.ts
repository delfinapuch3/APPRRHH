import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { obraScope, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  const scope = obraScope(req);
  const empleados = await prisma.employee.findMany({
    where: scope ? { obraId: { in: scope } } : undefined,
    include: { obra: true },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
  });
  res.json(empleados);
});

router.get("/:id", async (req, res) => {
  const scope = obraScope(req);
  const empleado = await prisma.employee.findUnique({
    where: { id: req.params.id },
    include: { obra: true },
  });
  if (!empleado) return res.status(404).json({ error: "No encontrado" });
  if (scope && (!empleado.obraId || !scope.includes(empleado.obraId))) {
    return res.status(403).json({ error: "Sin acceso a este empleado" });
  }
  res.json(empleado);
});

const empleadoSchema = z.object({
  legajo: z.string().min(1),
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  sindicato: z.string().nullable().optional(),
  fechaIngreso: z.coerce.date(),
  valorHoraNormal: z.number().positive(),
  obraId: z.string().nullable().optional(),
  activo: z.boolean().optional(),
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = empleadoSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const empleado = await prisma.employee.create({ data: parsed.data });
  res.status(201).json(empleado);
});

router.put("/:id", requireAdmin, async (req, res) => {
  const parsed = empleadoSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const empleado = await prisma.employee.update({ where: { id: req.params.id }, data: parsed.data });
  res.json(empleado);
});

export default router;
