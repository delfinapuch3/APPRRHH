import { recalcularSectorPeriodo } from "../engine/recalcular.js";

// Cache para los recálculos de SOLO LECTURA (dashboard y analítico). Esos
// endpoints recalculaban el mes entero de todos los empleados en cada carga,
// aunque los datos ya estén al día (las mutaciones ya disparan su propio
// recálculo). Cacheamos por (sector, rango) para no repetir el trabajo caro en
// cada request. Las mutaciones siguen llamando a recalcularSectorPeriodo directo
// (sin cache), así que nunca muestran datos viejos.
const RECALC_TTL_MS = 90_000; // 90 s
const ultimoRecalc = new Map<string, number>();
const enCurso = new Map<string, Promise<void>>();

/** Corre `fn` a lo sumo una vez cada RECALC_TTL_MS por `clave`. Si varios
 * requests piden la misma clave a la vez (el panel dispara todos los gráficos
 * en paralelo), comparten un único recálculo en vez de repetirlo. */
export async function recalcularConCache(clave: string, fn: () => Promise<void>): Promise<void> {
  const ahora = Date.now();
  if (ahora - (ultimoRecalc.get(clave) ?? 0) < RECALC_TTL_MS) return;

  const yaEnCurso = enCurso.get(clave);
  if (yaEnCurso) return yaEnCurso;

  const promesa = (async () => {
    try {
      await fn();
      ultimoRecalc.set(clave, Date.now());
    } finally {
      enCurso.delete(clave);
    }
  })();
  enCurso.set(clave, promesa);
  return promesa;
}

/** Igual que recalcularSectorPeriodo pero cacheado por (sector, rango). Usar solo
 * en endpoints de lectura (dashboard/analítico), nunca en mutaciones. */
export async function recalcularSectorPeriodoCacheado(sectorId: string | null, desde: Date, hasta: Date): Promise<void> {
  const clave = `${sectorId ?? "all"}:${desde.getTime()}:${hasta.getTime()}`;
  await recalcularConCache(clave, async () => {
    await recalcularSectorPeriodo(sectorId, desde, hasta);
  });
}
