import { prisma } from "../db.js";
import { calcularDia, type PayrollConfigLike, type TimeInterval } from "./calculo.js";
import { addUtcDays, dayOfWeekUtc, utcDateOnlyFrom } from "../lib/dates.js";

const startOfDay = utcDateOnlyFrom;

function eachDay(from: Date, to: Date): Date[] {
  const days: Date[] = [];
  let cur = startOfDay(from);
  const end = startOfDay(to);
  while (cur <= end) {
    days.push(cur);
    cur = addUtcDays(cur, 1);
  }
  return days;
}

async function getConfig(): Promise<PayrollConfigLike & { horasFrancoCompensatorio: number }> {
  const cfg = await prisma.payrollConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
  return cfg;
}

/**
 * Recalcula DailyCalculation para un empleado en un rango de fechas, a partir
 * de sus fichadas, ausencias, vacaciones y feriados vigentes. Es idempotente:
 * se puede volver a correr después de importar fichadas nuevas o cambiar la
 * configuración.
 */
export async function recalcularEmpleadoPeriodo(employeeId: string, desde: Date, hasta: Date) {
  const config = await getConfig();

  const [fichadas, ausencias, vacaciones, feriados] = await Promise.all([
    prisma.timeRecord.findMany({
      where: { employeeId, fecha: { gte: startOfDay(desde), lte: startOfDay(hasta) } },
    }),
    prisma.absence.findMany({
      where: { employeeId, fechaDesde: { lte: hasta }, fechaHasta: { gte: desde } },
    }),
    prisma.vacationPeriod.findMany({
      where: { employeeId, fechaDesde: { lte: hasta }, fechaHasta: { gte: desde } },
    }),
    prisma.holiday.findMany({
      where: { fecha: { gte: startOfDay(desde), lte: startOfDay(hasta) } },
    }),
  ]);

  const feriadosSet = new Set(feriados.map((f) => startOfDay(f.fecha).getTime()));

  const dias = eachDay(desde, hasta);
  const results: {
    fecha: Date;
    tipoDia: string;
    horasNormales: number;
    horasExtra50: number;
    horasExtra100: number;
    francoGenerado: boolean;
    ausente: boolean;
    justificada: boolean | null;
    tipoAusencia: string | null;
  }[] = [];

  for (const dia of dias) {
    const key = dia.getTime();
    const intervals: TimeInterval[] = fichadas
      .filter((f) => startOfDay(f.fecha).getTime() === key && f.horaSalida)
      .map((f) => ({ start: f.horaEntrada, end: f.horaSalida as Date }));

    const esFeriado = feriadosSet.has(key);
    const calc = calcularDia(dia, intervals, esFeriado, config);

    const totalTrabajado = calc.horasNormales + calc.horasExtra50 + calc.horasExtra100;
    const dow = dayOfWeekUtc(dia);
    const esDomingoLibre = dow === 0; // domingo es franco semanal, no cuenta como ausencia si no trabajó

    const vacacion = vacaciones.find((v) => startOfDay(v.fechaDesde) <= dia && startOfDay(v.fechaHasta) >= dia);
    const ausenciaCargada = ausencias.find(
      (a) => startOfDay(a.fechaDesde) <= dia && startOfDay(a.fechaHasta) >= dia
    );

    let ausente = false;
    let justificada: boolean | null = null;
    let tipoAusencia: string | null = null;

    if (totalTrabajado === 0 && !esDomingoLibre) {
      if (vacacion) {
        ausente = false; // día de vacaciones, no es falta
      } else if (ausenciaCargada) {
        ausente = true;
        justificada = ausenciaCargada.justificada;
        tipoAusencia = ausenciaCargada.tipo;
      } else {
        ausente = true;
        justificada = null; // sin clasificar todavía
        tipoAusencia = null;
      }
    }

    results.push({
      fecha: dia,
      tipoDia: calc.tipoDia,
      horasNormales: calc.horasNormales,
      horasExtra50: calc.horasExtra50,
      horasExtra100: calc.horasExtra100,
      francoGenerado: calc.francoGenerado,
      ausente,
      justificada,
      tipoAusencia,
    });
  }

  await prisma.$transaction(
    results.map((r) =>
      prisma.dailyCalculation.upsert({
        where: { employeeId_fecha: { employeeId, fecha: r.fecha } },
        update: {
          tipoDia: r.tipoDia as never,
          horasNormales: r.horasNormales,
          horasExtra50: r.horasExtra50,
          horasExtra100: r.horasExtra100,
          francoGenerado: r.francoGenerado,
          ausente: r.ausente,
          justificada: r.justificada,
          tipoAusencia: r.tipoAusencia as never,
        },
        create: {
          employeeId,
          fecha: r.fecha,
          tipoDia: r.tipoDia as never,
          horasNormales: r.horasNormales,
          horasExtra50: r.horasExtra50,
          horasExtra100: r.horasExtra100,
          francoGenerado: r.francoGenerado,
          ausente: r.ausente,
          justificada: r.justificada,
          tipoAusencia: r.tipoAusencia as never,
        },
      })
    )
  );

  // Genera registros de franco compensatorio para los días que corresponda
  // y que todavía no tengan uno generado.
  const diasConFranco = results.filter((r) => r.francoGenerado);
  for (const dia of diasConFranco) {
    const existente = await prisma.francoCompensatorio.findFirst({
      where: { employeeId, fechaGenerado: dia.fecha },
    });
    if (!existente) {
      await prisma.francoCompensatorio.create({
        data: {
          employeeId,
          fechaGenerado: dia.fecha,
          horas: config.horasFrancoCompensatorio,
        },
      });
    }
  }

  return results;
}

export async function recalcularObraPeriodo(obraId: string | null, desde: Date, hasta: Date) {
  const empleados = await prisma.employee.findMany({
    where: obraId ? { obraId, activo: true } : { activo: true },
    select: { id: true },
  });
  for (const e of empleados) {
    await recalcularEmpleadoPeriodo(e.id, desde, hasta);
  }
  return empleados.length;
}
