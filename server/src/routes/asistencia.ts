import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { sectorScope, requireAdmin } from "../middleware/auth.js";
import { recalcularSectorPeriodo, recalcularEmpleadoPeriodo } from "../engine/recalcular.js";
import { utcDateOnlyFrom } from "../lib/dates.js";

const router = Router();

function parseRange(req: import("express").Request) {
  const { desde, hasta } = req.query as Record<string, string | undefined>;
  const hoy = new Date();
  const fechaHasta = hasta ? new Date(hasta) : hoy;
  const fechaDesde = desde ? new Date(desde) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return { fechaDesde, fechaHasta };
}

router.get("/resumen", async (req, res) => {
  const scope = sectorScope(req);
  const { sectorId } = req.query as Record<string, string | undefined>;
  const { fechaDesde, fechaHasta } = parseRange(req);

  const effectiveSectorId = scope ? (scope.includes(sectorId ?? "") ? sectorId! : scope[0] ?? null) : sectorId ?? null;
  if (scope) {
    await recalcularSectorPeriodo(effectiveSectorId, fechaDesde, fechaHasta);
  } else {
    await recalcularSectorPeriodo(sectorId ?? null, fechaDesde, fechaHasta);
  }

  const empleados = await prisma.employee.findMany({
    where: {
      activo: true,
      ...(scope ? { sectorId: { in: scope } } : sectorId ? { sectorId } : {}),
    },
  });

  const empleadoIds = empleados.map((e) => e.id);
  const calculos = await prisma.dailyCalculation.findMany({
    where: { employeeId: { in: empleadoIds }, fecha: { gte: fechaDesde, lte: fechaHasta } },
  });

  const porEmpleado = empleados.map((emp) => {
    const dias = calculos.filter((c) => c.employeeId === emp.id);
    const diasEsperados = dias.filter((d) => d.tipoDia !== "DOMINGO").length;
    const ausenciasInjustificadas = dias.filter((d) => d.ausente && d.justificada === false).length;
    const ausenciasSinClasificar = dias.filter((d) => d.ausente && d.justificada === null).length;
    const ausenciasJustificadas = dias.filter((d) => d.ausente && d.justificada === true).length;
    const presentes = diasEsperados - ausenciasInjustificadas - ausenciasSinClasificar - ausenciasJustificadas;
    const porcentajeAsistencia = diasEsperados > 0 ? Math.round(((presentes + ausenciasJustificadas) / diasEsperados) * 1000) / 10 : 100;

    return {
      employeeId: emp.id,
      legajo: emp.legajo,
      nombre: `${emp.apellido}, ${emp.nombre}`,
      diasEsperados,
      presentes,
      ausenciasJustificadas,
      ausenciasInjustificadas,
      ausenciasSinClasificar,
      porcentajeAsistencia,
    };
  });

  const totalDiasEsperados = porEmpleado.reduce((a, e) => a + e.diasEsperados, 0);
  const totalPresentesOJustificados = porEmpleado.reduce((a, e) => a + e.presentes + e.ausenciasJustificadas, 0);
  const porcentajeGeneral = totalDiasEsperados > 0 ? Math.round((totalPresentesOJustificados / totalDiasEsperados) * 1000) / 10 : 100;

  res.json({ fechaDesde, fechaHasta, porcentajeGeneral, empleados: porEmpleado });
});

router.get("/dia", async (req, res) => {
  const scope = sectorScope(req);
  const { fecha, sectorId } = req.query as Record<string, string | undefined>;
  const dia = fecha ? new Date(fecha) : new Date();

  const effectiveSectorId = scope ? (scope.includes(sectorId ?? "") ? sectorId! : scope[0] ?? null) : sectorId ?? null;
  await recalcularSectorPeriodo(effectiveSectorId, dia, dia);

  const empleados = await prisma.employee.findMany({
    where: {
      activo: true,
      ...(scope ? { sectorId: { in: scope } } : sectorId ? { sectorId } : {}),
    },
    orderBy: [{ apellido: "asc" }, { nombre: "asc" }],
  });

  const calculos = await prisma.dailyCalculation.findMany({
    where: { employeeId: { in: empleados.map((e) => e.id) }, fecha: dia },
  });
  const porEmpleado = new Map(calculos.map((c) => [c.employeeId, c]));

  const roster = empleados.map((emp) => {
    const c = porEmpleado.get(emp.id);
    const horasTrabajadas = c ? c.horasNormales + c.horasExtra50 + c.horasExtra100 : 0;
    return {
      employeeId: emp.id,
      legajo: emp.legajo,
      nombre: `${emp.apellido}, ${emp.nombre}`,
      sectorId: emp.sectorId,
      tipoDia: c?.tipoDia ?? null,
      horasTrabajadas,
      ausente: c?.ausente ?? false,
      justificada: c?.justificada ?? null,
      tipoAusencia: c?.tipoAusencia ?? null,
      observaciones: c?.observaciones ?? null,
    };
  });

  res.json({ fecha: dia, empleados: roster });
});

router.get("/faltas-sin-clasificar", async (req, res) => {
  const scope = sectorScope(req);
  const { fechaDesde, fechaHasta } = parseRange(req);

  const empleados = await prisma.employee.findMany({
    where: { activo: true, ...(scope ? { sectorId: { in: scope } } : {}) },
    select: { id: true },
  });

  const faltas = await prisma.dailyCalculation.findMany({
    where: {
      employeeId: { in: empleados.map((e) => e.id) },
      fecha: { gte: fechaDesde, lte: fechaHasta },
      ausente: true,
      justificada: null,
    },
    include: { employee: true },
    orderBy: { fecha: "desc" },
  });

  res.json(faltas);
});

router.get("/empleado/:employeeId", async (req, res) => {
  const scope = sectorScope(req);
  const { employeeId } = req.params;
  const { fechaDesde, fechaHasta } = parseRange(req);

  const empleado = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!empleado) return res.status(404).json({ error: "No encontrado" });
  if (scope && (!empleado.sectorId || !scope.includes(empleado.sectorId))) {
    return res.status(403).json({ error: "Sin acceso a este empleado" });
  }

  await recalcularEmpleadoPeriodo(employeeId, fechaDesde, fechaHasta);

  const [calculos, fichadas] = await Promise.all([
    prisma.dailyCalculation.findMany({
      where: { employeeId, fecha: { gte: utcDateOnlyFrom(fechaDesde), lte: utcDateOnlyFrom(fechaHasta) } },
      orderBy: { fecha: "asc" },
    }),
    prisma.timeRecord.findMany({
      where: { employeeId, fecha: { gte: utcDateOnlyFrom(fechaDesde), lte: utcDateOnlyFrom(fechaHasta) } },
      orderBy: { horaEntrada: "asc" },
    }),
  ]);

  const fichadasPorDia = new Map<number, typeof fichadas>();
  for (const f of fichadas) {
    const key = utcDateOnlyFrom(f.fecha).getTime();
    if (!fichadasPorDia.has(key)) fichadasPorDia.set(key, []);
    fichadasPorDia.get(key)!.push(f);
  }

  const dias = calculos.map((c) => ({
    ...c,
    fichadas: fichadasPorDia.get(c.fecha.getTime()) ?? [],
  }));

  res.json(dias);
});

const validarSchema = z.object({ employeeId: z.string().min(1), fecha: z.coerce.date() });
router.put("/validar", requireAdmin, async (req, res) => {
  const parsed = validarSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { employeeId, fecha } = parsed.data;
  const dia = utcDateOnlyFrom(fecha);
  const calculo = await prisma.dailyCalculation.update({
    where: { employeeId_fecha: { employeeId, fecha: dia } },
    data: { extrasValidadas: true, validadoPorId: req.user!.id, fechaValidacion: new Date() },
  });
  res.json(calculo);
});

const horasManualSchema = z.object({
  employeeId: z.string().min(1),
  fecha: z.coerce.date(),
  horasTrabajadas: z.number().min(0).max(24).nullable(),
});
router.put("/horas-manual", requireAdmin, async (req, res) => {
  const parsed = horasManualSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { employeeId, fecha, horasTrabajadas } = parsed.data;
  const dia = utcDateOnlyFrom(fecha);

  if (horasTrabajadas === null) {
    await prisma.dailyCalculation.update({
      where: { employeeId_fecha: { employeeId, fecha: dia } },
      data: { horasManual: false },
    });
    await recalcularEmpleadoPeriodo(employeeId, dia, dia);
    const calculo = await prisma.dailyCalculation.findUnique({ where: { employeeId_fecha: { employeeId, fecha: dia } } });
    return res.json(calculo);
  }

  const existente = await prisma.dailyCalculation.findUnique({ where: { employeeId_fecha: { employeeId, fecha: dia } } });
  if (!existente) return res.status(404).json({ error: "No hay cálculo para ese día" });
  const horasNormales = Math.max(0, horasTrabajadas - existente.horasExtra50 - existente.horasExtra100);
  const calculo = await prisma.dailyCalculation.update({
    where: { employeeId_fecha: { employeeId, fecha: dia } },
    data: { horasNormales, horasManual: true, ausente: false },
  });
  res.json(calculo);
});

export default router;
