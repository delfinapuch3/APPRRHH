import { prisma } from "../db.js";
import { calcularDia, type PayrollConfigLike, type TimeInterval } from "./calculo.js";
import { addUtcDays, dayOfWeekUtc, localDateTime, utcDateOnlyFrom } from "../lib/dates.js";

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

interface FichadaLike {
  fecha: Date;
  horaEntrada: Date;
  horaSalida: Date | null;
}

/**
 * Arma los intervalos trabajados que corresponden al día calendario `dia`,
 * partiendo en la medianoche local cualquier fichada que la haya cruzado
 * (turnos como 20 a 4). La porción antes de medianoche queda para el día en
 * que arrancó el turno; la porción después, para el día siguiente. Así cada
 * mitad se calcula con las reglas (tipo de día, recargos) que le corresponden.
 */
export function intervalsParaDia(dia: Date, fichadas: FichadaLike[]): TimeInterval[] {
  const inicioDia = localDateTime(dia, 0, 0);
  const inicioSiguiente = localDateTime(addUtcDays(dia, 1), 0, 0);
  const diaKey = dia.getTime();
  const diaAnteriorKey = addUtcDays(dia, -1).getTime();

  const result: TimeInterval[] = [];
  for (const f of fichadas) {
    if (!f.horaSalida) continue;
    const fKey = startOfDay(f.fecha).getTime();
    if (fKey === diaKey) {
      const end = f.horaSalida > inicioSiguiente ? inicioSiguiente : f.horaSalida;
      if (end > f.horaEntrada) result.push({ start: f.horaEntrada, end });
    } else if (fKey === diaAnteriorKey && f.horaSalida > inicioDia) {
      const end = f.horaSalida > inicioSiguiente ? inicioSiguiente : f.horaSalida;
      if (end > inicioDia) result.push({ start: inicioDia, end });
    }
  }
  return result;
}

/**
 * Recalcula DailyCalculation para un empleado en un rango de fechas, a partir
 * de sus fichadas, ausencias, vacaciones y feriados vigentes. Es idempotente:
 * se puede volver a correr después de importar fichadas nuevas o cambiar la
 * configuración.
 */
export async function recalcularEmpleadoPeriodo(employeeId: string, desde: Date, hasta: Date) {
  const config = await getConfig();

  // Se trae un día extra hacia atrás para poder partir correctamente los
  // turnos que arrancaron el día anterior al rango pedido y cruzan medianoche.
  const [fichadas, ausencias, vacaciones, feriados] = await Promise.all([
    prisma.timeRecord.findMany({
      where: { employeeId, fecha: { gte: addUtcDays(startOfDay(desde), -1), lte: startOfDay(hasta) } },
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

  const existentes = await prisma.dailyCalculation.findMany({
    where: { employeeId, fecha: { gte: startOfDay(desde), lte: startOfDay(hasta) } },
  });
  const existentePorFecha = new Map(existentes.map((e) => [e.fecha.getTime(), e]));

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
    observaciones: string | null;
  }[] = [];

  for (const dia of dias) {
    const key = dia.getTime();
    const intervals = intervalsParaDia(dia, fichadas);

    const esFeriado = feriadosSet.has(key);
    const calc = calcularDia(dia, intervals, esFeriado, config);

    const dow = dayOfWeekUtc(dia);
    const esDomingoLibre = dow === 0; // domingo es franco semanal, no cuenta como ausencia si no trabajó

    // Hay fichada ese día si arrancó (o siguió) alguna marcación en este día calendario,
    // esté o no completa: una marcación sin salida (abierta) igual demuestra que vino a trabajar.
    const tieneFichada = fichadas.some((f) => startOfDay(f.fecha).getTime() === key);
    const tieneFichadaAbierta = fichadas.some((f) => startOfDay(f.fecha).getTime() === key && !f.horaSalida);

    const vacacion = vacaciones.find((v) => startOfDay(v.fechaDesde) <= dia && startOfDay(v.fechaHasta) >= dia);
    const ausenciaCargada = ausencias.find(
      (a) => startOfDay(a.fechaDesde) <= dia && startOfDay(a.fechaHasta) >= dia
    );

    let ausente = false;
    let justificada: boolean | null = null;
    let tipoAusencia: string | null = null;
    let observaciones: string | null = null;

    if (!tieneFichada && !esDomingoLibre) {
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
    } else if (tieneFichadaAbierta) {
      observaciones = "Fichada sin marcación de salida: revisar y completar manualmente";
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
      observaciones,
    });
  }

  // Los días marcados con horasManual fueron corregidos a mano por RRHH (ej.
  // redondear 7.9hs a 8hs): se dejan intactos y no se pisan con el recálculo
  // automático a partir de las fichadas.
  await prisma.$transaction(
    results
      .filter((r) => !existentePorFecha.get(r.fecha.getTime())?.horasManual)
      .map((r) => {
      const existente = existentePorFecha.get(r.fecha.getTime());
      const preservarValidacion =
        existente?.extrasValidadas && existente.horasExtra50 === r.horasExtra50 && existente.horasExtra100 === r.horasExtra100;
      const resetValidacion = preservarValidacion
        ? {}
        : { extrasValidadas: false, validadoPorId: null, fechaValidacion: null };

      return prisma.dailyCalculation.upsert({
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
          observaciones: r.observaciones,
          ...resetValidacion,
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
          observaciones: r.observaciones,
        },
      });
    })
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

export async function recalcularSectorPeriodo(sectorId: string | null, desde: Date, hasta: Date) {
  const empleados = await prisma.employee.findMany({
    where: sectorId ? { sectorId, activo: true } : { activo: true },
    select: { id: true },
  });
  for (const e of empleados) {
    await recalcularEmpleadoPeriodo(e.id, desde, hasta);
  }
  return empleados.length;
}
