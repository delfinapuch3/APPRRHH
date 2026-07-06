import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { obraScope, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  const scope = obraScope(req);
  const { activo } = req.query as Record<string, string | undefined>;
  const empleados = await prisma.employee.findMany({
    where: {
      ...(scope ? { obraId: { in: scope } } : {}),
      ...(activo === "true" ? { activo: true } : activo === "false" ? { activo: false } : {}),
    },
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

router.delete("/:id", requireAdmin, async (req, res) => {
  const id = req.params.id;
  const [fichadas, ausencias, vacaciones, francos, liquidaciones, calculos] = await Promise.all([
    prisma.timeRecord.count({ where: { employeeId: id } }),
    prisma.absence.count({ where: { employeeId: id } }),
    prisma.vacationPeriod.count({ where: { employeeId: id } }),
    prisma.francoCompensatorio.count({ where: { employeeId: id } }),
    prisma.payrollPeriod.count({ where: { employeeId: id } }),
    prisma.dailyCalculation.count({ where: { employeeId: id } }),
  ]);
  const tieneHistorial = fichadas + ausencias + vacaciones + francos + liquidaciones + calculos > 0;
  if (tieneHistorial) {
    return res.status(409).json({
      error:
        "No se puede eliminar: el empleado tiene fichadas, ausencias, vacaciones u otros registros históricos. Dalo de baja (marcalo inactivo) para conservar el historial en su lugar.",
    });
  }
  await prisma.employee.delete({ where: { id } });
  res.status(204).end();
});

export default router;
