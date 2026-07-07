import { Router } from "express";
import { z } from "zod";
import * as XLSX from "xlsx";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { recalcularEmpleadoPeriodo } from "../engine/recalcular.js";

const router = Router();
router.use(requireAdmin);

router.get("/", async (req, res) => {
  const { employeeId } = req.query as Record<string, string | undefined>;
  const liquidaciones = await prisma.payrollPeriod.findMany({
    where: employeeId ? { employeeId } : undefined,
    include: { employee: true },
    orderBy: { fechaDesde: "desc" },
  });
  res.json(liquidaciones);
});

router.get("/:id", async (req, res) => {
  const liquidacion = await prisma.payrollPeriod.findUnique({
    where: { id: req.params.id },
    include: { employee: true },
  });
  if (!liquidacion) return res.status(404).json({ error: "No encontrada" });
  res.json(liquidacion);
});

const generarSchema = z.object({
  employeeId: z.string().min(1),
  tipo: z.enum(["QUINCENAL", "MENSUAL"]),
  fechaDesde: z.coerce.date(),
  fechaHasta: z.coerce.date(),
});

router.post("/generar", async (req, res) => {
  const parsed = generarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { employeeId, tipo, fechaDesde, fechaHasta } = parsed.data;

  const empleado = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!empleado) return res.status(404).json({ error: "Empleado no encontrado" });

  await recalcularEmpleadoPeriodo(employeeId, fechaDesde, fechaHasta);

  const dias = await prisma.dailyCalculation.findMany({
    where: { employeeId, fecha: { gte: fechaDesde, lte: fechaHasta } },
  });
  const config = await prisma.payrollConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const horasNormales = dias.reduce((a, d) => a + d.horasNormales, 0);
  // Las horas extra solo cuentan para la liquidación una vez que RRHH las validó
  // día por día; las que quedan pendientes se informan aparte para que se sepa
  // que faltan validar (no se pagan solas por default).
  const diasValidados = dias.filter((d) => d.extrasValidadas);
  const diasSinValidar = dias.filter((d) => !d.extrasValidadas && (d.horasExtra50 > 0 || d.horasExtra100 > 0));
  const horasExtra50 = diasValidados.reduce((a, d) => a + d.horasExtra50, 0);
  const horasExtra100 = diasValidados.reduce((a, d) => a + d.horasExtra100, 0);
  const horasExtra50SinValidar = diasSinValidar.reduce((a, d) => a + d.horasExtra50, 0);
  const horasExtra100SinValidar = diasSinValidar.reduce((a, d) => a + d.horasExtra100, 0);

  const montoNormal = horasNormales * empleado.valorHoraNormal;
  const montoExtra50 = horasExtra50 * empleado.valorHoraNormal * config.multiplicadorExtra50;
  const montoExtra100 = horasExtra100 * empleado.valorHoraNormal * config.multiplicadorExtra100;
  const totalBruto = montoNormal + montoExtra50 + montoExtra100;

  const liquidacion = await prisma.payrollPeriod.create({
    data: {
      employeeId,
      tipo,
      fechaDesde,
      fechaHasta,
      horasNormales,
      horasExtra50,
      horasExtra100,
      montoNormal,
      montoExtra50,
      montoExtra100,
      totalBruto,
      generadoPorId: req.user!.id,
    },
  });

  res.status(201).json({
    ...liquidacion,
    horasExtra50SinValidar,
    horasExtra100SinValidar,
    diasSinValidarCount: diasSinValidar.length,
  });
});

router.put("/:id/cerrar", async (req, res) => {
  const liquidacion = await prisma.payrollPeriod.update({
    where: { id: req.params.id },
    data: { estado: "CERRADA" },
  });
  res.json(liquidacion);
});

router.delete("/:id", async (req, res) => {
  await prisma.payrollPeriod.delete({ where: { id: req.params.id } });
  res.status(204).end();
});

router.get("/:id/export.xlsx", async (req, res) => {
  const liquidacion = await prisma.payrollPeriod.findUnique({
    where: { id: req.params.id },
    include: { employee: true },
  });
  if (!liquidacion) return res.status(404).json({ error: "No encontrada" });

  const rows = [
    ["Legajo", liquidacion.employee.legajo],
    ["Empleado", `${liquidacion.employee.apellido}, ${liquidacion.employee.nombre}`],
    ["Período", `${liquidacion.fechaDesde.toLocaleDateString("es-AR")} - ${liquidacion.fechaHasta.toLocaleDateString("es-AR")}`],
    ["Tipo", liquidacion.tipo],
    [],
    ["Concepto", "Horas", "Monto"],
    ["Horas normales", liquidacion.horasNormales, liquidacion.montoNormal],
    ["Horas extra 50%", liquidacion.horasExtra50, liquidacion.montoExtra50],
    ["Horas extra 100%", liquidacion.horasExtra100, liquidacion.montoExtra100],
    [],
    ["Total bruto", "", liquidacion.totalBruto],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Liquidación");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="liquidacion-${liquidacion.employee.legajo}-${liquidacion.id}.xlsx"`);
  res.send(buffer);
});

export default router;
