/**
 * Convención de fechas en todo el server:
 * - Un campo "fecha" (calendario, sin hora) siempre se representa como
 *   medianoche UTC (igual que produce `new Date("YYYY-MM-DD")` tanto en el
 *   navegador como en Node). Por eso SIEMPRE se lee con getters UTC
 *   (getUTCDay, getUTCFullYear, etc.), nunca con los locales: el server
 *   corre en America/Buenos_Aires (UTC-3), y usar getters locales sobre una
 *   medianoche UTC corre el día hacia atrás.
 * - Un campo "horaEntrada"/"horaSalida" es un instante real (con hora de
 *   reloj) y se construye con el constructor local de Date para que
 *   represente la hora de pared correcta en Argentina.
 */

export function toUtcDateOnly(y: number, m0: number, d: number): Date {
  return new Date(Date.UTC(y, m0, d));
}

export function utcDateOnlyFrom(date: Date): Date {
  return toUtcDateOnly(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export function addUtcDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export function dayOfWeekUtc(date: Date): number {
  return date.getUTCDay();
}

/** Construye un instante real (hora de pared local) para el día calendario `fecha` (UTC-midnight). */
export function localDateTime(fecha: Date, hours: number, minutes: number, seconds = 0): Date {
  return new Date(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate(), hours, minutes, seconds, 0);
}

/** Formatea un instante real (hora de pared local) como "HH:MM". */
export function formatHHMM(instante: Date): string {
  return `${String(instante.getHours()).padStart(2, "0")}:${String(instante.getMinutes()).padStart(2, "0")}`;
}
