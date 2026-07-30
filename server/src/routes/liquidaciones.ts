import { Router } from "express";
import { z } from "zod";
import * as XLSX from "xlsx";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { recalcularEmpleadoPeriodo, recalcularSectorPeriodo } from "../engine/recalcular.js";
import { sendXlsx } from "../lib/xlsxExport.js";

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

/** Cantidad de días calendario en que [aDesde, aHasta] se superpone con [bDesde, bHasta] (0 si no se superponen). */
function diasSuperpuestos(aDesde: Date, aHasta: Date, bDesde: Date, bHasta: Date): number {
  const inicio = aDesde > bDesde ? aDesde : bDesde;
  const fin = aHasta < bHasta ? aHasta : bHasta;
  if (fin < inicio) return 0;
  return Math.round((fin.getTime() - inicio.getTime()) / 86_400_000) + 1;
}

/**
 * Planilla general: resumen de horas y montos de todo el personal activo
 * para un período, incluyendo las horas de vacaciones y de enfermedad
 * (calculadas como días superpuestos con el período × horas teóricas
 * diarias del empleado, ya que esos días no generan horas normales
 * trabajadas en el cálculo diario). Se reutiliza tanto para mostrarla en
 * pantalla como para exportarla a Excel.
 */
function agruparPorEmpleado<T extends { employeeId: string }>(items: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const item of items) {
    if (!map.has(item.employeeId)) map.set(item.employeeId, []);
    map.get(item.employeeId)!.push(item);
  }
  return map;
}

async function calcularPlanillaGeneral(fechaDesde: Date, fechaHasta: Date) {
  const empleados = await prisma.employee.findMany({ where: { activo: true }, orderBy: [{ apellido: "asc" }, { nombre: "asc" }] });
  const config = await prisma.payrollConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  // Recalcula todo el personal en lotes concurrentes (no uno por uno) y trae
  // los datos del período en un puñado de consultas para todos los
  // empleados a la vez, en vez de repetir varias consultas por cada uno:
  // con ~70 empleados, hacerlo secuencial tardaba más de dos minutos.
  await recalcularSectorPeriodo(null, fechaDesde, fechaHasta);

  const [todosDias, todosFrancos, todasVacaciones, todasAusenciasEnfermedad] = await Promise.all([
    prisma.dailyCalculation.findMany({ where: { fecha: { gte: fechaDesde, lte: fechaHasta } } }),
    prisma.francoCompensatorio.findMany({ where: { fechaGenerado: { gte: fechaDesde, lte: fechaHasta } } }),
    prisma.vacationPeriod.findMany({ where: { fechaDesde: { lte: fechaHasta }, fechaHasta: { gte: fechaDesde } } }),
    prisma.absence.findMany({
      where: {
        tipo: "ENFERMEDAD_ACCIDENTE_INCULPABLE",
        justificada: true,
        fechaDesde: { lte: fechaHasta },
        fechaHasta: { gte: fechaDesde },
      },
    }),
  ]);
  const diasPorEmpleado = agruparPorEmpleado(todosDias);
  const francosPorEmpleado = agruparPorEmpleado(todosFrancos);
  const vacacionesPorEmpleado = agruparPorEmpleado(todasVacaciones);
  const enfermedadPorEmpleado = agruparPorEmpleado(todasAusenciasEnfermedad);

  const filas = [];
  for (const empleado of empleados) {
    const dias = diasPorEmpleado.get(empleado.id) ?? [];
    const francos = francosPorEmpleado.get(empleado.id) ?? [];
    const vacacionesPeriodo = vacacionesPorEmpleado.get(empleado.id) ?? [];
    const ausenciasEnfermedad = enfermedadPorEmpleado.get(empleado.id) ?? [];

    const horasNormales = dias.reduce((a, d) => a + d.horasNormales, 0);
    const diasValidados = dias.filter((d) => d.extrasValidadas);
    const horasExtra50 = diasValidados.reduce((a, d) => a + d.horasExtra50, 0);
    const horasExtra100 = diasValidados.reduce((a, d) => a + d.horasExtra100, 0);
    const horasFranco = francos.reduce((a, f) => a + f.horas, 0);
    const diasVacaciones = vacacionesPeriodo.reduce(
      (a, v) => a + diasSuperpuestos(v.fechaDesde, v.fechaHasta, fechaDesde, fechaHasta),
      0
    );
    const diasEnfermedad = ausenciasEnfermedad.reduce(
      (a, aus) => a + diasSuperpuestos(aus.fechaDesde, aus.fechaHasta, fechaDesde, fechaHasta),
      0
    );
    const horasVacaciones = diasVacaciones * empleado.horasTeoricasDiarias;
    const horasEnfermedad = diasEnfermedad * empleado.horasTeoricasDiarias;

    const montoNormal = horasNormales * empleado.valorHoraNormal;
    const montoExtra50 = horasExtra50 * empleado.valorHoraNormal * config.multiplicadorExtra50;
    const montoExtra100 = horasExtra100 * empleado.valorHoraNormal * config.multiplicadorExtra100;
    const montoFranco = horasFranco * empleado.valorHoraNormal;
    const montoTotal = montoNormal + montoExtra50 + montoExtra100 + montoFranco;

    filas.push({
      nombre: `${empleado.apellido}, ${empleado.nombre}`,
      legajo: empleado.legajo,
      horasNormales: Math.round(horasNormales * 10) / 10,
      horasExtra50: Math.round(horasExtra50 * 10) / 10,
      horasExtra100: Math.round(horasExtra100 * 10) / 10,
      horasFranco: Math.round(horasFranco * 10) / 10,
      horasVacaciones: Math.round(horasVacaciones * 10) / 10,
      horasEnfermedad: Math.round(horasEnfermedad * 10) / 10,
      montoNormal: Math.round(montoNormal),
      montoExtra50: Math.round(montoExtra50),
      montoExtra100: Math.round(montoExtra100),
      montoFranco: Math.round(montoFranco),
      montoTotal: Math.round(montoTotal),
    });
  }
  return filas;
}

router.get("/planilla", async (req, res) => {
  const { desde, hasta } = req.query as Record<string, string | undefined>;
  if (!desde || !hasta) return res.status(400).json({ error: "Faltan desde/hasta" });
  const filas = await calcularPlanillaGeneral(new Date(desde), new Date(hasta));
  res.json(filas);
});

router.get("/export-planilla.xlsx", async (req, res) => {
  const { desde, hasta } = req.query as Record<string, string | undefined>;
  if (!desde || !hasta) return res.status(400).json({ error: "Faltan desde/hasta" });
  const filas = await calcularPlanillaGeneral(new Date(desde), new Date(hasta));

  const rows: unknown[][] = [
    [
      "Nombre",
      "Legajo",
      "Horas normales",
      "H. Extra 50%",
      "H. Extra 100%",
      "Franco comp.",
      "Horas vacaciones",
      "Horas enfermedad",
      "$ Hora normal",
      "$ Extra 50%",
      "$ Extra 100%",
      "$ Franco comp.",
      "$ Total",
    ],
    ...filas.map((f) => [
      f.nombre,
      f.legajo,
      f.horasNormales,
      f.horasExtra50,
      f.horasExtra100,
      f.horasFranco,
      f.horasVacaciones,
      f.horasEnfermedad,
      f.montoNormal,
      f.montoExtra50,
      f.montoExtra100,
      f.montoFranco,
      f.montoTotal,
    ]),
  ];

  sendXlsx(res, `planilla-general-${desde}-a-${hasta}.xlsx`, "Planilla general", rows);
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
