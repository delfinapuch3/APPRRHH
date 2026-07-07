import { Router } from "express";
import { prisma } from "../db.js";
import { sectorScope } from "../middleware/auth.js";
import { recalcularSectorPeriodo } from "../engine/recalcular.js";
import { addUtcDays, utcDateOnlyFrom } from "../lib/dates.js";
import { SECTOR_LUNES_A_VIERNES } from "../lib/constants.js";

const router = Router();

interface Filtros {
  empresaId?: string;
  sectorId?: string;
}

async function sectorIdsPermitidos(scope: string[] | null, filtros: Filtros): Promise<string[] | null> {
  // null = sin filtro de sector (ADMIN sin filtros elegidos)
  if (filtros.sectorId) {
    if (scope && !scope.includes(filtros.sectorId)) return [];
    return [filtros.sectorId];
  }
  if (filtros.empresaId) {
    const sectoresEmpresa = await prisma.sector.findMany({ where: { empresaId: filtros.empresaId }, select: { id: true } });
    const ids = sectoresEmpresa.map((s) => s.id);
    return scope ? ids.filter((id) => scope.includes(id)) : ids;
  }
  return scope;
}

function periodoARango(periodo: string | undefined): { desde: Date; hasta: Date } {
  const hoy = utcDateOnlyFrom(new Date());
  if (periodo === "7" || periodo === "15" || periodo === "30") {
    return { desde: addUtcDays(hoy, -(Number(periodo) - 1)), hasta: hoy };
  }
  // "mes" o default: mes en curso
  return { desde: utcDateOnlyFrom(new Date(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1)), hasta: hoy };
}

router.get("/resumen-hoy", async (req, res) => {
  const scope = sectorScope(req);
  const { empresaId, sectorId } = req.query as Record<string, string | undefined>;
  const sectorIds = await sectorIdsPermitidos(scope, { empresaId, sectorId });
  const hoy = utcDateOnlyFrom(new Date());

  const whereEmpleado = { activo: true, ...(sectorIds ? { sectorId: { in: sectorIds } } : {}) };
  const empleados = await prisma.employee.findMany({ where: whereEmpleado, select: { id: true, sectorId: true } });
  const empleadoIds = empleados.map((e) => e.id);

  if (sectorIds === null) {
    await recalcularSectorPeriodo(null, hoy, hoy);
  } else {
    for (const sid of new Set(empleados.map((e) => e.sectorId).filter((x): x is string => !!x))) {
      await recalcularSectorPeriodo(sid, hoy, hoy);
    }
  }

  const [calculos, tardanzasHoy, vacacionesHoy] = await Promise.all([
    prisma.dailyCalculation.findMany({ where: { employeeId: { in: empleadoIds }, fecha: hoy } }),
    prisma.absence.count({
      where: { employeeId: { in: empleadoIds }, tipo: "TARDANZA", fechaDesde: { lte: hoy }, fechaHasta: { gte: hoy } },
    }),
    prisma.vacationPeriod.count({
      where: { employeeId: { in: empleadoIds }, fechaDesde: { lte: hoy }, fechaHasta: { gte: hoy } },
    }),
  ]);

  const totalActivos = empleados.length;
  const ausentesHoy = calculos.filter((c) => c.ausente).length;
  const presentesHoy = totalActivos - ausentesHoy;

  const pct = (n: number) => (totalActivos > 0 ? Math.round((n / totalActivos) * 1000) / 10 : 0);

  res.json({
    totalActivos,
    presentes: { cantidad: presentesHoy, porcentaje: pct(presentesHoy) },
    ausentes: { cantidad: ausentesHoy, porcentaje: pct(ausentesHoy) },
    tardes: { cantidad: tardanzasHoy, porcentaje: pct(tardanzasHoy) },
    vacaciones: { cantidad: vacacionesHoy, porcentaje: pct(vacacionesHoy) },
  });
});

router.get("/top-ausencias", async (req, res) => {
  const scope = sectorScope(req);
  const { empresaId, sectorId, periodo } = req.query as Record<string, string | undefined>;
  const sectorIds = await sectorIdsPermitidos(scope, { empresaId, sectorId });
  const { desde, hasta } = periodoARango(periodo);

  const empleados = await prisma.employee.findMany({
    where: { activo: true, ...(sectorIds ? { sectorId: { in: sectorIds } } : {}) },
  });
  const empleadoIds = empleados.map((e) => e.id);

  if (sectorIds === null) {
    await recalcularSectorPeriodo(null, desde, hasta);
  } else {
    for (const sid of new Set(empleados.map((e) => e.sectorId).filter((x): x is string => !!x))) {
      await recalcularSectorPeriodo(sid, desde, hasta);
    }
  }

  const calculos = await prisma.dailyCalculation.findMany({
    where: { employeeId: { in: empleadoIds }, fecha: { gte: desde, lte: hasta }, ausente: true },
  });

  const conteoPorEmpleado = new Map<string, number>();
  for (const c of calculos) {
    conteoPorEmpleado.set(c.employeeId, (conteoPorEmpleado.get(c.employeeId) ?? 0) + 1);
  }

  const top = empleados
    .map((e) => ({ employeeId: e.id, legajo: e.legajo, nombre: `${e.apellido}, ${e.nombre}`, ausencias: conteoPorEmpleado.get(e.id) ?? 0 }))
    .filter((e) => e.ausencias > 0)
    .sort((a, b) => b.ausencias - a.ausencias)
    .slice(0, 10);

  res.json(top);
});

router.get("/horas-por-sector", async (req, res) => {
  const scope = sectorScope(req);
  const { empresaId, periodo } = req.query as Record<string, string | undefined>;
  const { desde, hasta } = periodoARango(periodo);

  const sectores = await prisma.sector.findMany({
    where: { ...(empresaId ? { empresaId } : {}), ...(scope ? { id: { in: scope } } : {}) },
  });

  const resultado = [];
  for (const sector of sectores) {
    await recalcularSectorPeriodo(sector.id, desde, hasta);
    const empleados = await prisma.employee.findMany({ where: { sectorId: sector.id, activo: true } });
    const empleadoIds = empleados.map((e) => e.id);
    const calculos = await prisma.dailyCalculation.findMany({
      where: { employeeId: { in: empleadoIds }, fecha: { gte: desde, lte: hasta } },
    });

    const horasTrabajadas = calculos.reduce((a, c) => a + c.horasNormales + c.horasExtra50 + c.horasExtra100, 0);
    const diasEsperadosPorEmpleado = new Map<string, number>();
    for (const c of calculos) {
      if (c.tipoDia !== "DOMINGO" && !(sector.nombre === SECTOR_LUNES_A_VIERNES && c.tipoDia === "SABADO")) {
        diasEsperadosPorEmpleado.set(c.employeeId, (diasEsperadosPorEmpleado.get(c.employeeId) ?? 0) + 1);
      }
    }
    const horasTeoricas = empleados.reduce((a, e) => a + (diasEsperadosPorEmpleado.get(e.id) ?? 0) * e.horasTeoricasDiarias, 0);

    resultado.push({
      sectorId: sector.id,
      sector: sector.nombre,
      horasTrabajadas: Math.round(horasTrabajadas * 10) / 10,
      horasTeoricas: Math.round(horasTeoricas * 10) / 10,
    });
  }

  res.json(resultado);
});

router.get("/horas-extra-por-sector", async (req, res) => {
  const scope = sectorScope(req);
  const { empresaId, periodo } = req.query as Record<string, string | undefined>;
  const { desde, hasta } = periodoARango(periodo);

  const sectores = await prisma.sector.findMany({
    where: { ...(empresaId ? { empresaId } : {}), ...(scope ? { id: { in: scope } } : {}) },
  });

  const resultado = [];
  for (const sector of sectores) {
    await recalcularSectorPeriodo(sector.id, desde, hasta);
    const empleados = await prisma.employee.findMany({ where: { sectorId: sector.id, activo: true }, select: { id: true } });
    const calculos = await prisma.dailyCalculation.findMany({
      where: { employeeId: { in: empleados.map((e) => e.id) }, fecha: { gte: desde, lte: hasta } },
    });
    const extra50 = calculos.reduce((a, c) => a + c.horasExtra50, 0);
    const extra100 = calculos.reduce((a, c) => a + c.horasExtra100, 0);
    resultado.push({
      sectorId: sector.id,
      sector: sector.nombre,
      horasExtra50: Math.round(extra50 * 10) / 10,
      horasExtra100: Math.round(extra100 * 10) / 10,
    });
  }

  res.json(resultado);
});

export default router;
