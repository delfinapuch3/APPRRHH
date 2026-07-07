import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { sectorScope } from "../middleware/auth.js";
import { diasCorrespondientes, type TramoVacaciones } from "../engine/vacaciones.js";
import { sendXlsx } from "../lib/xlsxExport.js";
import { recalcularEmpleadoPeriodo } from "../engine/recalcular.js";

const router = Router();

router.get("/export.xlsx", async (req, res) => {
  const scope = sectorScope(req);
  const { employeeId } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (scope) where.employee = { sectorId: { in: scope } };
  const periodos = await prisma.vacationPeriod.findMany({
    where,
    include: { employee: true },
    orderBy: { fechaDesde: "desc" },
  });
  const rows = [
    ["Legajo", "Empleado", "Año", "Desde", "Hasta", "Días tomados", "Observaciones"],
    ...periodos.map((p) => [
      p.employee.legajo,
      `${p.employee.apellido}, ${p.employee.nombre}`,
      p.anioCorrespondiente,
      p.fechaDesde.toLocaleDateString("es-AR", { timeZone: "UTC" }),
      p.fechaHasta.toLocaleDateString("es-AR", { timeZone: "UTC" }),
      p.diasTomados,
      p.observaciones ?? "",
    ]),
  ];
  sendXlsx(res, "vacaciones.xlsx", "Vacaciones", rows);
});

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
  const scope = sectorScope(req);
  const { employeeId } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (scope) where.employee = { sectorId: { in: scope } };
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
  // Los días dentro de este período dejan de contar como ausencia: hay que
  // recalcular para que se refleje enseguida en Asistencia y el Dashboard.
  await recalcularEmpleadoPeriodo(periodo.employeeId, periodo.fechaDesde, periodo.fechaHasta);
  res.status(201).json(periodo);
});

router.put("/:id", async (req, res) => {
  const parsed = vacacionSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const anterior = await prisma.vacationPeriod.findUnique({ where: { id: req.params.id } });
  if (!anterior) return res.status(404).json({ error: "No encontrado" });
  const periodo = await prisma.vacationPeriod.update({ where: { id: req.params.id }, data: parsed.data });
  // Recalcula tanto el rango viejo (por si se achicó o cambió de empleado) como el nuevo.
  await recalcularEmpleadoPeriodo(anterior.employeeId, anterior.fechaDesde, anterior.fechaHasta);
  if (periodo.employeeId !== anterior.employeeId || periodo.fechaDesde.getTime() !== anterior.fechaDesde.getTime() || periodo.fechaHasta.getTime() !== anterior.fechaHasta.getTime()) {
    await recalcularEmpleadoPeriodo(periodo.employeeId, periodo.fechaDesde, periodo.fechaHasta);
  }
  res.json(periodo);
});

router.delete("/:id", async (req, res) => {
  const periodo = await prisma.vacationPeriod.delete({ where: { id: req.params.id } });
  // Sin el período, esos días vuelven a evaluarse como ausencia si no hay fichada.
  await recalcularEmpleadoPeriodo(periodo.employeeId, periodo.fechaDesde, periodo.fechaHasta);
  res.status(204).end();
});

export default router;
