import { prisma } from "../db.js";
import { calcularDia, type PayrollConfigLike, type TimeInterval } from "./calculo.js";
import { addUtcDays, dayOfWeekUtc, localDateTime, minutosDelDiaArgentina, utcDateOnlyFrom } from "../lib/dates.js";
import { SECTORES_LUNES_A_VIERNES } from "../lib/constants.js";

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

interface TurnoLike {
  id: string;
  horaInicio: string;
  horaFin: string;
  toleranciaMinutos: number;
}

function parseHora(hhmm: string): { h: number; m: number; min: number } {
  const [h, m] = hhmm.split(":").map(Number);
  return { h, m, min: h * 60 + m };
}

function distanciaCircular(aMin: number, bMin: number): number {
  const diff = Math.abs(aMin - bMin) % 1440;
  return Math.min(diff, 1440 - diff);
}

/**
 * El turno del catálogo más parecido a la marcación real: compara tanto la
 * entrada (contra horaInicio) como la salida (contra horaFin, si ya se
 * conoce) para no confundir turnos que arrancan a la misma hora pero duran
 * distinto (ej. "Oficina" 08-16 vs "Turno pasante" 08-12 con la misma
 * entrada 08:00 pero salidas muy distintas).
 */
function detectarTurno(entradaMin: number, salidaMin: number | null, turnos: TurnoLike[]): TurnoLike | null {
  if (turnos.length === 0) return null;
  const distancia = (t: TurnoLike): number => {
    const dEntrada = distanciaCircular(entradaMin, parseHora(t.horaInicio).min);
    if (salidaMin === null) return dEntrada;
    return dEntrada + distanciaCircular(salidaMin, parseHora(t.horaFin).min);
  };
  return turnos.reduce((mejor, t) => (distancia(t) < distancia(mejor) ? t : mejor));
}

/** Instantes reales (horario pactado) de inicio/fin del turno para el día calendario `dia`, resolviendo turnos que cruzan medianoche (ej. 22-06). */
function anclaTurno(dia: Date, turno: TurnoLike): { inicio: Date; fin: Date } {
  const ini = parseHora(turno.horaInicio);
  const fin = parseHora(turno.horaFin);
  const inicio = localDateTime(dia, ini.h, ini.m);
  const finDate = fin.min <= ini.min ? localDateTime(addUtcDays(dia, 1), fin.h, fin.m) : localDateTime(dia, fin.h, fin.m);
  return { inicio, fin: finDate };
}

/**
 * Ajusta las fichadas de cada día calendario según el turno del catálogo más
 * cercano a la entrada real. El margen (toleranciaMinutos) es una gracia
 * única de hasta esos minutos, para llegar tarde o para irse antes: dentro
 * del margen se redondea a la hora exacta del turno; pasado el margen, se
 * cuenta el horario real (se pierden esos minutos de las horas normales) y
 * además se marca tardanza o retiro anticipado según corresponda. Si se
 * queda trabajando más de toleranciaMinutos después del fin de turno, ese
 * tiempo de más se acredita igual (queda como hora extra sujeta a
 * validación de RRHH). Si no hay ningún turno activo en el catálogo, no se
 * ajusta nada (se sigue usando la marcación real tal cual, como antes de
 * tener turnos).
 */
export function ajustarFichadasPorTurno(
  fichadas: FichadaLike[],
  turnos: TurnoLike[]
): { ajustadas: FichadaLike[]; tardePorDia: Map<number, boolean>; retiroAnticipadoPorDia: Map<number, boolean> } {
  const tardePorDia = new Map<number, boolean>();
  const retiroAnticipadoPorDia = new Map<number, boolean>();
  if (turnos.length === 0) return { ajustadas: fichadas, tardePorDia, retiroAnticipadoPorDia };

  const grupos = new Map<number, FichadaLike[]>();
  for (const f of fichadas) {
    const key = startOfDay(f.fecha).getTime();
    const arr = grupos.get(key) ?? [];
    arr.push(f);
    grupos.set(key, arr);
  }

  const ajustadas: FichadaLike[] = [];
  for (const [key, grupoSinOrdenar] of grupos) {
    const grupo = [...grupoSinOrdenar].sort((a, b) => a.horaEntrada.getTime() - b.horaEntrada.getTime());
    const diaGrupo = startOfDay(grupo[0].fecha);
    const primeraEntrada = grupo[0].horaEntrada;
    const entradaMin = minutosDelDiaArgentina(primeraEntrada);
    const ultimaSalidaRaw = grupo[grupo.length - 1].horaSalida;
    const salidaMin = ultimaSalidaRaw ? minutosDelDiaArgentina(ultimaSalidaRaw) : null;
    const turno = detectarTurno(entradaMin, salidaMin, turnos);
    if (!turno) {
      ajustadas.push(...grupo);
      continue;
    }
    const { inicio: anchorInicio, fin: anchorFin } = anclaTurno(diaGrupo, turno);
    const desvioEntrada = (primeraEntrada.getTime() - anchorInicio.getTime()) / 60_000;
    const tarde = desvioEntrada > turno.toleranciaMinutos;
    tardePorDia.set(key, tarde);

    grupo.forEach((f, i) => {
      const esPrimera = i === 0;
      const esUltima = i === grupo.length - 1;
      // Dentro del margen (incluida la llegada temprana) se acredita desde el
      // horario pactado; pasado el margen de tardanza, se pierde ese tiempo
      // real (se acredita desde que fichó, no desde el horario del turno).
      const horaEntrada = esPrimera ? (tarde ? f.horaEntrada : anchorInicio) : f.horaEntrada;
      let horaSalida = f.horaSalida;
      if (esUltima && f.horaSalida) {
        const desvioSalida = (f.horaSalida.getTime() - anchorFin.getTime()) / 60_000;
        horaSalida = Math.abs(desvioSalida) > turno.toleranciaMinutos ? f.horaSalida : anchorFin;
        retiroAnticipadoPorDia.set(key, desvioSalida < -turno.toleranciaMinutos);
      }
      ajustadas.push({ fecha: f.fecha, horaEntrada, horaSalida });
    });
  }
  return { ajustadas, tardePorDia, retiroAnticipadoPorDia };
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
  const [empleado, fichadas, ausencias, vacaciones, feriados, turnosActivos] = await Promise.all([
    prisma.employee.findUnique({
      where: { id: employeeId },
      select: { sector: { select: { nombre: true } } },
    }),
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
    prisma.jornada.findMany({
      where: { activo: true },
      select: { id: true, horaInicio: true, horaFin: true, toleranciaMinutos: true },
    }),
  ]);
  const trabajaLunesAViernesNomas = !!empleado?.sector?.nombre && SECTORES_LUNES_A_VIERNES.includes(empleado.sector.nombre);

  const { ajustadas: fichadasAjustadas, tardePorDia, retiroAnticipadoPorDia } = ajustarFichadasPorTurno(fichadas, turnosActivos);

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
    tarde: boolean;
    retiroAnticipado: boolean;
  }[] = [];

  for (const dia of dias) {
    const key = dia.getTime();
    const intervals = intervalsParaDia(dia, fichadasAjustadas);

    const esFeriado = feriadosSet.has(key);
    const calc = calcularDia(dia, intervals, esFeriado, config);

    const dow = dayOfWeekUtc(dia);
    const esDomingoLibre = dow === 0; // domingo es franco semanal, no cuenta como ausencia si no trabajó
    const esSabadoNoLaboral = dow === 6 && trabajaLunesAViernesNomas;

    // Hay fichada ese día si arrancó (o siguió) alguna marcación en este día calendario,
    // esté o no completa: una marcación sin salida (abierta) igual demuestra que vino a trabajar.
    const fichadasDelDia = fichadas.filter((f) => startOfDay(f.fecha).getTime() === key);
    const tieneFichada = fichadasDelDia.length > 0;
    const tieneFichadaAbierta = fichadasDelDia.some((f) => !f.horaSalida);

    // Tardanza: se detecta comparando la primera marcación del día contra el
    // horario pactado del turno más cercano (ver ajustarFichadasPorTurno).
    const tarde = tieneFichada && !esDomingoLibre && !esSabadoNoLaboral ? tardePorDia.get(key) ?? false : false;
    const retiroAnticipado =
      tieneFichada && !esDomingoLibre && !esSabadoNoLaboral ? retiroAnticipadoPorDia.get(key) ?? false : false;

    const vacacion = vacaciones.find((v) => startOfDay(v.fechaDesde) <= dia && startOfDay(v.fechaHasta) >= dia);
    const ausenciaCargada = ausencias.find(
      (a) => startOfDay(a.fechaDesde) <= dia && startOfDay(a.fechaHasta) >= dia
    );

    let ausente = false;
    let justificada: boolean | null = null;
    let tipoAusencia: string | null = null;
    let observaciones: string | null = null;

    if (!tieneFichada && !esDomingoLibre && !esSabadoNoLaboral) {
      if (vacacion) {
        ausente = false; // día de vacaciones, no es falta
      } else if (ausenciaCargada) {
        ausente = true;
        justificada = ausenciaCargada.justificada;
        tipoAusencia = ausenciaCargada.tipo;
      } else if (esFeriado) {
        ausente = false; // feriado no laborable: no cuenta como falta si no hay licencia cargada
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
      tarde,
      retiroAnticipado,
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
          tarde: r.tarde,
          retiroAnticipado: r.retiroAnticipado,
          ...resetValidacion,
        },
        create: {
          employeeId,
          fecha: r.fecha,
          tipoDia: r.tipoDia as never,
          horasNormales: r.horasNormales,
          horasExtra50: r.horasExtra50,
          horasExtra100: r.horasExtra100,
          tarde: r.tarde,
          retiroAnticipado: r.retiroAnticipado,
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
  // Recalculamos los empleados en lotes concurrentes (en vez de uno por uno) para
  // reducir mucho el tiempo total: cada empleado escribe sus propias filas, así
  // que no hay conflictos entre ellos. El lote acotado evita saturar la base.
  const LOTE = 8;
  for (let i = 0; i < empleados.length; i += LOTE) {
    await Promise.all(empleados.slice(i, i + LOTE).map((e) => recalcularEmpleadoPeriodo(e.id, desde, hasta)));
  }
  return empleados.length;
}
