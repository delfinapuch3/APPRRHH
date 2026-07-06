import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db.js";
import { recalcularEmpleadoPeriodo } from "../engine/recalcular.js";
import { localDateTime } from "../lib/dates.js";
import { parseMarcaciones, parseWorkbookAllSheets, pickBestSheet, toDateOnlyFromCell, type ParsedSheet } from "../lib/excelImport.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const KEYWORDS = ["legajo", "fecha", "marcacion", "entrada", "salida"];

interface CachedImport {
  nombreArchivo: string;
  sheetNames: string[];
  sheets: Record<string, ParsedSheet>;
  expiresAt: number;
}
const cache = new Map<string, CachedImport>();

function cleanupCache() {
  const now = Date.now();
  for (const [token, entry] of cache) {
    if (entry.expiresAt < now) cache.delete(token);
  }
}

function sheetSummary(sheetNames: string[], sheet: string, parsed: ParsedSheet) {
  return {
    sheetNames,
    sheet,
    headers: parsed.headers,
    sample: parsed.rows.slice(0, 15),
    totalRows: parsed.rows.length,
  };
}

router.post("/preview", upload.single("file"), (req, res) => {
  cleanupCache();
  if (!req.file) return res.status(400).json({ error: "Falta el archivo" });
  try {
    const { sheetNames, sheets } = parseWorkbookAllSheets(req.file.buffer);
    const nonEmpty = sheetNames.filter((n) => sheets[n].rows.length > 0);
    if (nonEmpty.length === 0) return res.status(400).json({ error: "El archivo no tiene filas en ninguna hoja" });
    const sheet = pickBestSheet(nonEmpty, sheets, KEYWORDS);
    const token = randomUUID();
    cache.set(token, {
      nombreArchivo: req.file.originalname,
      sheetNames,
      sheets,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    res.json({ token, ...sheetSummary(sheetNames, sheet, sheets[sheet]) });
  } catch {
    res.status(400).json({ error: "No se pudo leer el archivo. Verificá que sea .xlsx o .csv" });
  }
});

router.post("/preview-sheet", (req, res) => {
  const { token, sheet } = req.body as { token?: string; sheet?: string };
  if (!token || !sheet) return res.status(400).json({ error: "Falta token o nombre de hoja" });
  const entry = cache.get(token);
  if (!entry) return res.status(400).json({ error: "La vista previa expiró, volvé a subir el archivo" });
  const parsed = entry.sheets[sheet];
  if (!parsed) return res.status(400).json({ error: "Esa hoja no existe en el archivo" });
  res.json(sheetSummary(entry.sheetNames, sheet, parsed));
});

function combineFechaHora(fecha: Date, value: unknown): Date | null {
  if (value instanceof Date) {
    return localDateTime(fecha, value.getUTCHours(), value.getUTCMinutes(), value.getUTCSeconds());
  }
  if (typeof value === "number") {
    const fractionalDay = value - Math.floor(value);
    const totalSeconds = Math.round(fractionalDay * 86400);
    return localDateTime(fecha, Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60), totalSeconds % 60);
  }
  if (typeof value === "string" && value.trim()) {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (match) {
      return localDateTime(fecha, Number(match[1]), Number(match[2]), match[3] ? Number(match[3]) : 0);
    }
  }
  return null;
}

function horaStringToDate(fecha: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(":").map(Number);
  return localDateTime(fecha, h, m);
}

const confirmSchema = z.object({
  token: z.string(),
  sheet: z.string(),
  mapping: z.object({
    legajo: z.string(),
    fecha: z.string(),
    modo: z.enum(["separado", "combinado"]).default("separado"),
    horaEntrada: z.string().optional(),
    horaSalida: z.string().optional(),
    marcaciones: z.string().optional(),
  }),
});

router.post("/confirm", async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { token, sheet, mapping } = parsed.data;
  const entry = cache.get(token);
  if (!entry) return res.status(400).json({ error: "La vista previa expiró, volvé a subir el archivo" });
  const hoja = entry.sheets[sheet];
  if (!hoja) return res.status(400).json({ error: "Esa hoja no existe en el archivo" });

  const empleados = await prisma.employee.findMany({ select: { id: true, legajo: true } });
  const legajoToId = new Map(empleados.map((e) => [e.legajo.trim(), e.id]));

  const errores: string[] = [];
  const registrosPorEmpleado = new Map<string, { min: Date; max: Date }>();
  let insertados = 0;
  const created: { employeeId: string; fecha: Date; horaEntrada: Date; horaSalida: Date | null }[] = [];

  function marcarRango(employeeId: string, fecha: Date) {
    const rango = registrosPorEmpleado.get(employeeId);
    if (!rango) {
      registrosPorEmpleado.set(employeeId, { min: fecha, max: fecha });
    } else {
      if (fecha < rango.min) rango.min = fecha;
      if (fecha > rango.max) rango.max = fecha;
    }
  }

  hoja.rows.forEach((row, idx) => {
    const legajoRaw = String(row[mapping.legajo] ?? "").trim();
    if (!legajoRaw) return; // fila vacía
    const employeeId = legajoToId.get(legajoRaw);
    if (!employeeId) {
      errores.push(`Fila ${idx + 2}: legajo "${legajoRaw}" no encontrado`);
      return;
    }
    const fecha = toDateOnlyFromCell(row[mapping.fecha]);
    if (!fecha) {
      errores.push(`Fila ${idx + 2}: fecha inválida`);
      return;
    }

    if (mapping.modo === "combinado") {
      const raw = String(row[mapping.marcaciones ?? ""] ?? "").trim();
      if (!raw) return; // día sin marcaciones (franco, ausente, etc.)
      const pares = parseMarcaciones(raw);
      if (pares.length === 0) {
        errores.push(`Fila ${idx + 2}: no se pudieron interpretar las marcaciones "${raw}"`);
        return;
      }
      for (const par of pares) {
        created.push({
          employeeId,
          fecha,
          horaEntrada: horaStringToDate(fecha, par.entradaStr),
          horaSalida: par.salidaStr ? horaStringToDate(fecha, par.salidaStr) : null,
        });
        insertados += 1;
      }
      marcarRango(employeeId, fecha);
      return;
    }

    const horaEntrada = combineFechaHora(fecha, row[mapping.horaEntrada ?? ""]);
    if (!horaEntrada) {
      errores.push(`Fila ${idx + 2}: hora de entrada inválida`);
      return;
    }
    const horaSalida = mapping.horaSalida ? combineFechaHora(fecha, row[mapping.horaSalida]) : null;
    created.push({ employeeId, fecha, horaEntrada, horaSalida });
    marcarRango(employeeId, fecha);
    insertados += 1;
  });

  const batch = await prisma.importBatch.create({
    data: {
      nombreArchivo: entry.nombreArchivo,
      usuarioId: req.user!.id,
      cantidadRegistros: insertados,
      cantidadErrores: errores.length,
      logDetalle: errores.length ? errores.join("\n") : null,
    },
  });

  if (created.length > 0) {
    await prisma.timeRecord.createMany({
      data: created.map((c) => ({ ...c, origen: "IMPORTADO" as const, importBatchId: batch.id })),
    });
  }

  for (const [employeeId, rango] of registrosPorEmpleado) {
    await recalcularEmpleadoPeriodo(employeeId, rango.min, rango.max);
  }

  cache.delete(token);
  res.json({ batchId: batch.id, insertados, errores });
});

export default router;
