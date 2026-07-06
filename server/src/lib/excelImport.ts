import * as XLSX from "xlsx";
import { toUtcDateOnly } from "./dates.js";

export function parseWorkbook(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
  return { rows, headers };
}

export function excelSerialToDate(serial: number): Date {
  // Excel epoch: 1899-12-30
  const utcDays = Math.floor(serial - 25569);
  const utcMs = utcDays * 86400 * 1000;
  const fractionalDay = serial - Math.floor(serial);
  const ms = utcMs + Math.round(fractionalDay * 86400 * 1000);
  return new Date(ms);
}

/**
 * Interpreta strings de fecha en formato ISO ("2026-07-05...") o DD/MM/YYYY
 * (convención Argentina), tolerando un prefijo de día de semana como
 * "Lu 01/06/2026" (formato típico de reportes de relojes biométricos).
 */
export function parseDateString(value: string): Date | null {
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    return toUtcDateOnly(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
  }
  const dmy = trimmed.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (dmy) {
    return toUtcDateOnly(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]));
  }
  return null;
}

// Nota: SheetJS (xlsx) con cellDates:true arma los Date de celdas de fecha/hora
// usando componentes UTC (no conoce zonas horarias). Por eso acá siempre se
// leen con getters UTC, y las fechas-calendario se normalizan a medianoche
// UTC para ser consistentes con el resto del server (ver lib/dates.ts).
export function toDateOnlyFromCell(value: unknown): Date | null {
  if (value instanceof Date) return toUtcDateOnly(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate());
  if (typeof value === "number") {
    const d = excelSerialToDate(value);
    return toUtcDateOnly(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  }
  if (typeof value === "string" && value.trim()) {
    return parseDateString(value);
  }
  return null;
}

/** Interpreta números con formato argentino ("3.500,50" o "3500,50") o plano ("3500.5" / "3500"). */
export function parseNumeroAR(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.includes(",")) {
    const normalized = trimmed.replace(/\./g, "").replace(",", ".");
    const n = Number(normalized);
    return isNaN(n) ? null : n;
  }
  const n = Number(trimmed);
  return isNaN(n) ? null : n;
}

export interface Marcacion {
  entradaStr: string;
  salidaStr: string | null;
}

/**
 * Extrae pares entrada/salida de una celda "Marcaciones" combinada, ej.
 * "E 08:07 - S 15:56" o con varios tramos por corte de almuerzo
 * "E 08:00 - S 12:00  E 13:00 - S 17:00". Una "E" sin "S" que la cierre
 * queda con salidaStr = null (fichada abierta / marcación faltante).
 */
export function parseMarcaciones(value: string): Marcacion[] {
  const tokens = Array.from(value.matchAll(/([ES])\s*(\d{1,2}:\d{2})/g)).map((m) => ({
    tipo: m[1] as "E" | "S",
    hora: m[2],
  }));
  const result: Marcacion[] = [];
  let current: Marcacion | null = null;
  for (const t of tokens) {
    if (t.tipo === "E") {
      if (current) result.push(current);
      current = { entradaStr: t.hora, salidaStr: null };
    } else if (current) {
      current.salidaStr = t.hora;
      result.push(current);
      current = null;
    }
  }
  if (current) result.push(current);
  return result;
}
