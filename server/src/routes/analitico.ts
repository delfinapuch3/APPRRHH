import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin, sectorScope } from "../middleware/auth.js";
import { recalcularSectorPeriodo } from "../engine/recalcular.js";
import { utcDateOnlyFrom } from "../lib/dates.js";
import { SECTOR_LUNES_A_VIERNES } from "../lib/constants.js";
import { parseWorkbookAllSheets, pickBestSheet, toDateOnlyFromCell, type ParsedSheet } from "../lib/excelImport.js";

const router = Router();

const MS_POR_ANIO = 365.25 * 86_400_000;
function edadEnAnios(desde: Date, hasta: Date): number {
  return (hasta.getTime() - desde.getTime()) / MS_POR_ANIO;
}

function esDiaEsperado(tipoDia: string, trabajaLunesAViernesNomas: boolean): boolean {
  return tipoDia !== "DOMINGO" && !(trabajaLunesAViernesNomas && tipoDia === "SABADO");
}

router.get("/resumen", async (req, res) => {
  const scope = sectorScope(req);
  const empleados = await prisma.employee.findMany({
    where: { activo: true, ...(scope ? { sectorId: { in: scope } } : {}) },
    select: { id: true, sectorId: true, fechaNacimiento: true, fechaIngreso: true, sector: { select: { nombre: true } } },
  });
  const empleadoIds = empleados.map((e) => e.id);
  const empleadoById = new Map(empleados.map((e) => [e.id, e]));

  const hoy = utcDateOnlyFrom(new Date());
  const desde = utcDateOnlyFrom(new Date(hoy.getUTCFullYear(), hoy.getUTCMonth(), 1));

  if (scope === null) {
    await recalcularSectorPeriodo(null, desde, hoy);
  } else {
    const sectorIds = new Set(empleados.map((e) => e.sectorId).filter((x): x is string => !!x));
    for (const sid of sectorIds) await recalcularSectorPeriodo(sid, desde, hoy);
  }

  const [calculos, tardanzasManuales] = await Promise.all([
    prisma.dailyCalculation.findMany({ where: { employeeId: { in: empleadoIds }, fecha: { gte: desde, lte: hoy } } }),
    prisma.absence.findMany({
      where: { employeeId: { in: empleadoIds }, tipo: "TARDANZA", fechaDesde: { gte: desde, lte: hoy } },
      select: { employeeId: true, fechaDesde: true },
    }),
  ]);

  const tardeSet = new Set<string>();
  for (const c of calculos) if (c.tarde) tardeSet.add(`${c.employeeId}|${c.fecha.getTime()}`);
  for (const a of tardanzasManuales) tardeSet.add(`${a.employeeId}|${a.fechaDesde.getTime()}`);

  let diasEsperados = 0;
  let diasAusentes = 0;
  for (const c of calculos) {
    const emp = empleadoById.get(c.employeeId);
    const trabajaLunesAViernesNomas = emp?.sector?.nombre === SECTOR_LUNES_A_VIERNES;
    if (esDiaEsperado(c.tipoDia, trabajaLunesAViernesNomas)) {
      diasEsperados += 1;
      if (c.ausente) diasAusentes += 1;
    }
  }
  const diasTarde = [...tardeSet].length;

  const conFechaNacimiento = empleados.filter((e) => e.fechaNacimiento);
  const promedioEdad =
    conFechaNacimiento.length > 0
      ? Math.round((conFechaNacimiento.reduce((a, e) => a + edadEnAnios(e.fechaNacimiento!, hoy), 0) / conFechaNacimiento.length) * 10) / 10
      : null;
  const promedioAntiguedad =
    empleados.length > 0
      ? Math.round((empleados.reduce((a, e) => a + edadEnAnios(e.fechaIngreso, hoy), 0) / empleados.length) * 10) / 10
      : 0;

  res.json({
    cantidadEmpleados: empleados.length,
    ausentismo: diasEsperados > 0 ? Math.round((diasAusentes / diasEsperados) * 1000) / 10 : 0,
    tardanza: diasEsperados > 0 ? Math.round((diasTarde / diasEsperados) * 1000) / 10 : 0,
    promedioEdad,
    promedioAntiguedad,
  });
});

router.get("/ausentismo-por-mes", async (req, res) => {
  const scope = sectorScope(req);
  const empleados = await prisma.employee.findMany({
    where: { activo: true, ...(scope ? { sectorId: { in: scope } } : {}) },
    select: { id: true, sectorId: true, sector: { select: { nombre: true } } },
  });
  const empleadoIds = empleados.map((e) => e.id);
  const empleadoById = new Map(empleados.map((e) => [e.id, e]));
  const sectorIds = scope ? new Set(empleados.map((e) => e.sectorId).filter((x): x is string => !!x)) : null;

  const hoy = utcDateOnlyFrom(new Date());
  const meses: { desde: Date; hasta: Date; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const base = new Date(hoy.getUTCFullYear(), hoy.getUTCMonth() - i, 1);
    const desde = utcDateOnlyFrom(base);
    const finMes = utcDateOnlyFrom(new Date(base.getFullYear(), base.getMonth() + 1, 0));
    const hasta = i === 0 ? hoy : finMes;
    const label = desde.toLocaleDateString("es-AR", { month: "short", year: "2-digit", timeZone: "UTC" });
    meses.push({ desde, hasta, label });
  }

  const resultado = [];
  for (const mes of meses) {
    if (scope === null) {
      await recalcularSectorPeriodo(null, mes.desde, mes.hasta);
    } else if (sectorIds) {
      for (const sid of sectorIds) await recalcularSectorPeriodo(sid, mes.desde, mes.hasta);
    }
    const calculos = await prisma.dailyCalculation.findMany({
      where: { employeeId: { in: empleadoIds }, fecha: { gte: mes.desde, lte: mes.hasta } },
    });
    let esperados = 0;
    let ausentes = 0;
    for (const c of calculos) {
      const emp = empleadoById.get(c.employeeId);
      const trabajaLunesAViernesNomas = emp?.sector?.nombre === SECTOR_LUNES_A_VIERNES;
      if (esDiaEsperado(c.tipoDia, trabajaLunesAViernesNomas)) {
        esperados += 1;
        if (c.ausente) ausentes += 1;
      }
    }
    resultado.push({ mes: mes.label, ausentismo: esperados > 0 ? Math.round((ausentes / esperados) * 1000) / 10 : 0 });
  }
  res.json(resultado);
});

router.get("/por-genero", async (req, res) => {
  const scope = sectorScope(req);
  const empleados = await prisma.employee.findMany({
    where: { activo: true, ...(scope ? { sectorId: { in: scope } } : {}) },
    select: { genero: true },
  });
  const conteo = new Map<string, number>();
  for (const e of empleados) {
    const clave = e.genero?.trim() || "Sin especificar";
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  }
  res.json([...conteo.entries()].map(([genero, cantidad]) => ({ genero, cantidad })));
});

const BUCKETS_ANTIGUEDAD = [
  { label: "0-2 años", min: 0, max: 2 },
  { label: "2-5 años", min: 2, max: 5 },
  { label: "5-10 años", min: 5, max: 10 },
  { label: "10-20 años", min: 10, max: 20 },
  { label: "20+ años", min: 20, max: Infinity },
] as const;

router.get("/por-antiguedad", async (req, res) => {
  const scope = sectorScope(req);
  const empleados = await prisma.employee.findMany({
    where: { activo: true, ...(scope ? { sectorId: { in: scope } } : {}) },
    select: { fechaIngreso: true },
  });
  const hoy = utcDateOnlyFrom(new Date());
  const conteo = new Map(BUCKETS_ANTIGUEDAD.map((b) => [b.label, 0]));
  for (const e of empleados) {
    const anios = edadEnAnios(e.fechaIngreso, hoy);
    const bucket = BUCKETS_ANTIGUEDAD.find((b) => anios >= b.min && anios < b.max) ?? BUCKETS_ANTIGUEDAD[BUCKETS_ANTIGUEDAD.length - 1];
    conteo.set(bucket.label, (conteo.get(bucket.label) ?? 0) + 1);
  }
  res.json(BUCKETS_ANTIGUEDAD.map((b) => ({ rango: b.label, cantidad: conteo.get(b.label) ?? 0 })));
});

router.get("/por-empresa", async (req, res) => {
  const scope = sectorScope(req);
  const empleados = await prisma.employee.findMany({
    where: { activo: true, ...(scope ? { sectorId: { in: scope } } : {}) },
    select: { sector: { select: { empresa: { select: { nombre: true } } } } },
  });
  const conteo = new Map<string, number>();
  for (const e of empleados) {
    const clave = e.sector?.empresa?.nombre ?? "Sin empresa";
    conteo.set(clave, (conteo.get(clave) ?? 0) + 1);
  }
  res.json([...conteo.entries()].map(([empresa, cantidad]) => ({ empresa, cantidad })));
});

// --- Importación de datos demográficos (fecha de nacimiento / género), por legajo ---

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const KEYWORDS = ["legajo", "nacimiento", "genero", "sexo"];

interface CachedImport {
  sheetNames: string[];
  sheets: Record<string, ParsedSheet>;
  expiresAt: number;
}
const cache = new Map<string, CachedImport>();
function cleanupCache() {
  const now = Date.now();
  for (const [token, entry] of cache) if (entry.expiresAt < now) cache.delete(token);
}
function sheetSummary(sheetNames: string[], sheet: string, parsed: ParsedSheet) {
  return { sheetNames, sheet, headers: parsed.headers, sample: parsed.rows.slice(0, 15), totalRows: parsed.rows.length };
}

router.post("/import-demografia/preview", requireAdmin, upload.single("file"), (req, res) => {
  cleanupCache();
  if (!req.file) return res.status(400).json({ error: "Falta el archivo" });
  try {
    const { sheetNames, sheets } = parseWorkbookAllSheets(req.file.buffer);
    const nonEmpty = sheetNames.filter((n) => sheets[n].rows.length > 0);
    if (nonEmpty.length === 0) return res.status(400).json({ error: "El archivo no tiene filas en ninguna hoja" });
    const sheet = pickBestSheet(nonEmpty, sheets, KEYWORDS);
    const token = randomUUID();
    cache.set(token, { sheetNames, sheets, expiresAt: Date.now() + 15 * 60 * 1000 });
    res.json({ token, ...sheetSummary(sheetNames, sheet, sheets[sheet]) });
  } catch {
    res.status(400).json({ error: "No se pudo leer el archivo. Verificá que sea .xlsx o .csv" });
  }
});

router.post("/import-demografia/preview-sheet", requireAdmin, (req, res) => {
  const { token, sheet } = req.body as { token?: string; sheet?: string };
  if (!token || !sheet) return res.status(400).json({ error: "Falta token o nombre de hoja" });
  const entry = cache.get(token);
  if (!entry) return res.status(400).json({ error: "La vista previa expiró, volvé a subir el archivo" });
  const parsed = entry.sheets[sheet];
  if (!parsed) return res.status(400).json({ error: "Esa hoja no existe en el archivo" });
  res.json(sheetSummary(entry.sheetNames, sheet, parsed));
});

const confirmDemografiaSchema = z.object({
  token: z.string(),
  sheet: z.string(),
  mapping: z.object({
    legajo: z.string().min(1),
    fechaNacimiento: z.string().optional(),
    genero: z.string().optional(),
  }),
});

router.post("/import-demografia/confirm", requireAdmin, async (req, res) => {
  const parsed = confirmDemografiaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { token, sheet, mapping } = parsed.data;
  const entry = cache.get(token);
  if (!entry) return res.status(400).json({ error: "La vista previa expiró, volvé a subir el archivo" });
  const hoja = entry.sheets[sheet];
  if (!hoja) return res.status(400).json({ error: "Esa hoja no existe en el archivo" });

  const errores: string[] = [];
  let actualizados = 0;

  for (let idx = 0; idx < hoja.rows.length; idx++) {
    const row = hoja.rows[idx];
    const legajo = String(row[mapping.legajo] ?? "").trim();
    if (!legajo) continue; // fila vacía

    const data: { fechaNacimiento?: Date; genero?: string } = {};
    if (mapping.fechaNacimiento) {
      const fecha = toDateOnlyFromCell(row[mapping.fechaNacimiento]);
      if (fecha) data.fechaNacimiento = fecha;
    }
    if (mapping.genero) {
      const genero = String(row[mapping.genero] ?? "").trim();
      if (genero) data.genero = genero;
    }
    if (Object.keys(data).length === 0) continue;

    try {
      await prisma.employee.update({ where: { legajo }, data });
      actualizados += 1;
    } catch {
      errores.push(`Fila ${idx + 2}: legajo "${legajo}" no encontrado, se omitió`);
    }
  }

  cache.delete(token);
  res.json({ actualizados, errores });
});

export default router;
