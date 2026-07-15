import { Router } from "express";
import { prisma } from "../db.js";
import { sectorScope } from "../middleware/auth.js";
import { recalcularSectorPeriodo } from "../engine/recalcular.js";
import { addUtcDays, utcDateOnlyFrom } from "../lib/dates.js";
import { SECTORES_LUNES_A_VIERNES } from "../lib/constants.js";

const router = Router();

interface Filtros {
  empresaId?: string;
  sectorId?: string;
}

/** Empleados activos visibles para el usuario, cruzando el alcance de sectores (encargado) con los filtros de empresa/sector elegidos en la UI. */
async function empleadosPermitidos(scope: string[] | null, filtros: Filtros) {
  if (filtros.sectorId && scope && !scope.includes(filtros.sectorId)) return [];
  return prisma.employee.findMany({
    where: {
      activo: true,
      ...(filtros.sectorId ? { sectorId: filtros.sectorId } : scope ? { sectorId: { in: scope } } : {}),
      ...(filtros.empresaId ? { empresaId: filtros.empresaId } : {}),
    },
    select: { id: true, sectorId: true, legajo: true, nombre: true, apellido: true, horasTeoricasDiarias: true, sector: { select: { nombre: true } } },
  });
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
  const hoy = utcDateOnlyFrom(new Date());

  const empleados = await empleadosPermitidos(scope, { empresaId, sectorId });
  const empleadoIds = empleados.map((e) => e.id);

  if (scope === null && !empresaId && !sectorId) {
    await recalcularSectorPeriodo(null, hoy, hoy);
  } else {
    for (const sid of new Set(empleados.map((e) => e.sectorId).filter((x): x is string => !!x))) {
      await recalcularSectorPeriodo(sid, hoy, hoy);
    }
  }

  const [calculos, tardanzasManuales, vacacionesHoy] = await Promise.all([
    prisma.dailyCalculation.findMany({ where: { employeeId: { in: empleadoIds }, fecha: hoy } }),
    prisma.absence.findMany({
      where: { employeeId: { in: empleadoIds }, tipo: "TARDANZA", fechaDesde: { lte: hoy }, fechaHasta: { gte: hoy } },
      select: { employeeId: true },
    }),
    prisma.vacationPeriod.count({
      where: { employeeId: { in: empleadoIds }, fechaDesde: { lte: hoy }, fechaHasta: { gte: hoy } },
    }),
  ]);

  const totalActivos = empleados.length;
  const ausentesHoy = calculos.filter((c) => c.ausente).length;
  const presentesHoy = totalActivos - ausentesHoy;
  // Combina la tardanza detectada automáticamente por jornada (DailyCalculation.tarde)
  // con las cargadas a mano (Absence tipo TARDANZA), sin contar dos veces al mismo empleado.
  const tardesIds = new Set<string>([
    ...calculos.filter((c) => c.tarde).map((c) => c.employeeId),
    ...tardanzasManuales.map((a) => a.employeeId),
  ]);

  const pct = (n: number) => (totalActivos > 0 ? Math.round((n / totalActivos) * 1000) / 10 : 0);

  res.json({
    totalActivos,
    presentes: { cantidad: presentesHoy, porcentaje: pct(presentesHoy) },
    ausentes: { cantidad: ausentesHoy, porcentaje: pct(ausentesHoy) },
    tardes: { cantidad: tardesIds.size, porcentaje: pct(tardesIds.size) },
    vacaciones: { cantidad: vacacionesHoy, porcentaje: pct(vacacionesHoy) },
  });
});

/** El detalle (lista de empleados) detrás de cada número de /resumen-hoy, para hacer las cards clickeables. */
router.get("/detalle-hoy", async (req, res) => {
  const scope = sectorScope(req);
  const { empresaId, sectorId } = req.query as Record<string, string | undefined>;
  const hoy = utcDateOnlyFrom(new Date());

  const empleados = await empleadosPermitidos(scope, { empresaId, sectorId });
  const empleadoIds = empleados.map((e) => e.id);

  if (scope === null && !empresaId && !sectorId) {
    await recalcularSectorPeriodo(null, hoy, hoy);
  } else {
    for (const sid of new Set(empleados.map((e) => e.sectorId).filter((x): x is string => !!x))) {
      await recalcularSectorPeriodo(sid, hoy, hoy);
    }
  }

  const [calculos, tardanzasManuales, vacaciones] = await Promise.all([
    prisma.dailyCalculation.findMany({ where: { employeeId: { in: empleadoIds }, fecha: hoy } }),
    prisma.absence.findMany({
      where: { employeeId: { in: empleadoIds }, tipo: "TARDANZA", fechaDesde: { lte: hoy }, fechaHasta: { gte: hoy } },
      select: { employeeId: true },
    }),
    prisma.vacationPeriod.findMany({
      where: { employeeId: { in: empleadoIds }, fechaDesde: { lte: hoy }, fechaHasta: { gte: hoy } },
      select: { employeeId: true },
    }),
  ]);

  const calculoPorEmpleado = new Map(calculos.map((c) => [c.employeeId, c]));
  const tardanzaManualIds = new Set(tardanzasManuales.map((a) => a.employeeId));
  const vacacionIds = new Set(vacaciones.map((v) => v.employeeId));

  const info = (e: (typeof empleados)[number]) => ({
    employeeId: e.id,
    legajo: e.legajo,
    nombre: `${e.apellido}, ${e.nombre}`,
    sector: e.sector?.nombre ?? null,
  });

  res.json({
    presentes: empleados.filter((e) => !calculoPorEmpleado.get(e.id)?.ausente).map(info),
    ausentes: empleados.filter((e) => calculoPorEmpleado.get(e.id)?.ausente).map(info),
    tardes: empleados.filter((e) => calculoPorEmpleado.get(e.id)?.tarde || tardanzaManualIds.has(e.id)).map(info),
    vacaciones: empleados.filter((e) => vacacionIds.has(e.id)).map(info),
  });
});

router.get("/top-ausencias", async (req, res) => {
  const scope = sectorScope(req);
  const { empresaId, sectorId, periodo } = req.query as Record<string, string | undefined>;
  const { desde, hasta } = periodoARango(periodo);

  const empleados = await empleadosPermitidos(scope, { empresaId, sectorId });
  const empleadoIds = empleados.map((e) => e.id);

  if (scope === null && !empresaId && !sectorId) {
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

router.get("/top-tardanzas", async (req, res) => {
  const scope = sectorScope(req);
  const { empresaId, sectorId, periodo } = req.query as Record<string, string | undefined>;
  const { desde, hasta } = periodoARango(periodo);

  const empleados = await empleadosPermitidos(scope, { empresaId, sectorId });
  const empleadoIds = empleados.map((e) => e.id);

  if (scope === null && !empresaId && !sectorId) {
    await recalcularSectorPeriodo(null, desde, hasta);
  } else {
    for (const sid of new Set(empleados.map((e) => e.sectorId).filter((x): x is string => !!x))) {
      await recalcularSectorPeriodo(sid, desde, hasta);
    }
  }

  const calculos = await prisma.dailyCalculation.findMany({
    where: { employeeId: { in: empleadoIds }, fecha: { gte: desde, lte: hasta }, OR: [{ tarde: true }, { retiroAnticipado: true }] },
  });

  const conteoPorEmpleado = new Map<string, { tardanzas: number; retirosAnticipados: number }>();
  for (const c of calculos) {
    const actual = conteoPorEmpleado.get(c.employeeId) ?? { tardanzas: 0, retirosAnticipados: 0 };
    if (c.tarde) actual.tardanzas += 1;
    if (c.retiroAnticipado) actual.retirosAnticipados += 1;
    conteoPorEmpleado.set(c.employeeId, actual);
  }

  const top = empleados
    .map((e) => {
      const c = conteoPorEmpleado.get(e.id) ?? { tardanzas: 0, retirosAnticipados: 0 };
      return {
        employeeId: e.id,
        legajo: e.legajo,
        nombre: `${e.apellido}, ${e.nombre}`,
        tardanzas: c.tardanzas,
        retirosAnticipados: c.retirosAnticipados,
        total: c.tardanzas + c.retirosAnticipados,
      };
    })
    .filter((e) => e.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  res.json(top);
});

/** Agrupa los empleados visibles (ya filtrados por empresa/sector/alcance) por su sector. */
function agruparPorSector<T extends { sectorId: string | null }>(empleados: T[]): Map<string, T[]> {
  const porSector = new Map<string, T[]>();
  for (const e of empleados) {
    if (!e.sectorId) continue;
    const arr = porSector.get(e.sectorId) ?? [];
    arr.push(e);
    porSector.set(e.sectorId, arr);
  }
  return porSector;
}

router.get("/horas-por-sector", async (req, res) => {
  const scope = sectorScope(req);
  const { empresaId, periodo } = req.query as Record<string, string | undefined>;
  const { desde, hasta } = periodoARango(periodo);

  const empleados = await empleadosPermitidos(scope, { empresaId });
  const porSector = agruparPorSector(empleados);

  const resultado = [];
  for (const [sectorId, emps] of porSector) {
    await recalcularSectorPeriodo(sectorId, desde, hasta);
    const empleadoIds = emps.map((e) => e.id);
    const calculos = await prisma.dailyCalculation.findMany({
      where: { employeeId: { in: empleadoIds }, fecha: { gte: desde, lte: hasta } },
    });

    const sectorNombre = emps[0].sector?.nombre ?? "";
    const horasTrabajadas = calculos.reduce((a, c) => a + c.horasNormales + c.horasExtra50 + c.horasExtra100, 0);
    const diasEsperadosPorEmpleado = new Map<string, number>();
    for (const c of calculos) {
      if (c.tipoDia !== "DOMINGO" && !(SECTORES_LUNES_A_VIERNES.includes(sectorNombre) && c.tipoDia === "SABADO")) {
        diasEsperadosPorEmpleado.set(c.employeeId, (diasEsperadosPorEmpleado.get(c.employeeId) ?? 0) + 1);
      }
    }
    const horasTeoricas = emps.reduce((a, e) => a + (diasEsperadosPorEmpleado.get(e.id) ?? 0) * e.horasTeoricasDiarias, 0);

    resultado.push({
      sectorId,
      sector: sectorNombre,
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

  const empleados = await empleadosPermitidos(scope, { empresaId });
  const porSector = agruparPorSector(empleados);
  const config = await prisma.payrollConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });

  const resultado = [];
  for (const [sectorId, emps] of porSector) {
    await recalcularSectorPeriodo(sectorId, desde, hasta);
    const empleadoIds = emps.map((e) => e.id);
    const valorHoraPorEmpleado = new Map(
      (await prisma.employee.findMany({ where: { id: { in: empleadoIds } }, select: { id: true, valorHoraNormal: true } })).map((e) => [
        e.id,
        e.valorHoraNormal,
      ])
    );
    const calculos = await prisma.dailyCalculation.findMany({
      where: { employeeId: { in: empleadoIds }, fecha: { gte: desde, lte: hasta } },
    });
    const extra50 = calculos.reduce((a, c) => a + c.horasExtra50, 0);
    const extra100 = calculos.reduce((a, c) => a + c.horasExtra100, 0);
    const montoExtra50 = calculos.reduce(
      (a, c) => a + c.horasExtra50 * (valorHoraPorEmpleado.get(c.employeeId) ?? 0) * config.multiplicadorExtra50,
      0
    );
    const montoExtra100 = calculos.reduce(
      (a, c) => a + c.horasExtra100 * (valorHoraPorEmpleado.get(c.employeeId) ?? 0) * config.multiplicadorExtra100,
      0
    );
    resultado.push({
      sectorId,
      sector: emps[0].sector?.nombre ?? "",
      horasExtra50: Math.round(extra50 * 10) / 10,
      horasExtra100: Math.round(extra100 * 10) / 10,
      montoExtra50: Math.round(montoExtra50),
      montoExtra100: Math.round(montoExtra100),
    });
  }

  res.json(resultado);
});

/** Desglose por empleado de un sector (al hacer clic en su barra en los gráficos del dashboard). */
router.get("/detalle-sector", async (req, res) => {
  const scope = sectorScope(req);
  const { sectorId, empresaId, periodo } = req.query as Record<string, string | undefined>;
  if (!sectorId) return res.status(400).json({ error: "Falta sectorId" });
  if (scope && !scope.includes(sectorId)) return res.status(403).json({ error: "Sin acceso a este sector" });
  const { desde, hasta } = periodoARango(periodo);

  const sector = await prisma.sector.findUnique({ where: { id: sectorId } });
  if (!sector) return res.status(404).json({ error: "Sector no encontrado" });
  const trabajaLunesAViernesNomas = SECTORES_LUNES_A_VIERNES.includes(sector.nombre);

  const empleados = await prisma.employee.findMany({
    where: { sectorId, activo: true, ...(empresaId ? { empresaId } : {}) },
    select: { id: true, legajo: true, nombre: true, apellido: true, horasTeoricasDiarias: true, valorHoraNormal: true },
  });
  const empleadoIds = empleados.map((e) => e.id);

  await recalcularSectorPeriodo(sectorId, desde, hasta);
  const [calculos, config] = await Promise.all([
    prisma.dailyCalculation.findMany({ where: { employeeId: { in: empleadoIds }, fecha: { gte: desde, lte: hasta } } }),
    prisma.payrollConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } }),
  ]);

  const empleadosResultado = empleados
    .map((e) => {
      const calcsEmpleado = calculos.filter((c) => c.employeeId === e.id);
      const horasNormales = calcsEmpleado.reduce((a, c) => a + c.horasNormales, 0);
      const horasExtra50 = calcsEmpleado.reduce((a, c) => a + c.horasExtra50, 0);
      const horasExtra100 = calcsEmpleado.reduce((a, c) => a + c.horasExtra100, 0);
      const diasEsperados = calcsEmpleado.filter(
        (c) => c.tipoDia !== "DOMINGO" && !(trabajaLunesAViernesNomas && c.tipoDia === "SABADO")
      ).length;
      return {
        employeeId: e.id,
        legajo: e.legajo,
        nombre: `${e.apellido}, ${e.nombre}`,
        horasTrabajadas: Math.round((horasNormales + horasExtra50 + horasExtra100) * 10) / 10,
        horasTeoricas: Math.round(diasEsperados * e.horasTeoricasDiarias * 10) / 10,
        horasExtra50: Math.round(horasExtra50 * 10) / 10,
        horasExtra100: Math.round(horasExtra100 * 10) / 10,
        montoExtra50: Math.round(horasExtra50 * e.valorHoraNormal * config.multiplicadorExtra50),
        montoExtra100: Math.round(horasExtra100 * e.valorHoraNormal * config.multiplicadorExtra100),
      };
    })
    .sort((a, b) => b.horasTrabajadas - a.horasTrabajadas);

  res.json({ sector: sector.nombre, empleados: empleadosResultado });
});

export default router;
