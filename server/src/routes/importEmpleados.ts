import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { parseNumeroAR, parseWorkbookAllSheets, pickBestSheet, toDateOnlyFromCell, type ParsedSheet } from "../lib/excelImport.js";
import { utcDateOnlyFrom } from "../lib/dates.js";

const router = Router();
router.use(requireAdmin);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

const KEYWORDS = ["legajo", "nombre", "apellido", "hora", "sindicato"];

interface CachedImport {
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
    cache.set(token, { sheetNames, sheets, expiresAt: Date.now() + 15 * 60 * 1000 });
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

const confirmSchema = z.object({
  token: z.string(),
  sheet: z.string(),
  mapping: z.object({
    legajo: z.string(),
    nombre: z.string(),
    apellido: z.string(),
    valorHoraNormal: z.string(),
    fechaIngreso: z.string().optional(),
    sindicato: z.string().optional(),
    obra: z.string().optional(),
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

  const obras = await prisma.obra.findMany();
  const obraByNombre = new Map(obras.map((o) => [o.nombre.trim().toLowerCase(), o.id]));
  const hoy = utcDateOnlyFrom(new Date());

  const errores: string[] = [];
  let creados = 0;
  let actualizados = 0;

  for (let idx = 0; idx < hoja.rows.length; idx++) {
    const row = hoja.rows[idx];
    const legajo = String(row[mapping.legajo] ?? "").trim();
    if (!legajo) continue; // fila vacía

    const nombre = String(row[mapping.nombre] ?? "").trim();
    const apellido = String(row[mapping.apellido] ?? "").trim();
    if (!nombre || !apellido) {
      errores.push(`Fila ${idx + 2}: falta nombre o apellido`);
      continue;
    }
    const valorHoraNormal = parseNumeroAR(row[mapping.valorHoraNormal]);
    if (valorHoraNormal === null || valorHoraNormal <= 0) {
      errores.push(`Fila ${idx + 2}: valor hora normal inválido`);
      continue;
    }

    let fechaIngreso = mapping.fechaIngreso ? toDateOnlyFromCell(row[mapping.fechaIngreso]) : null;
    if (!fechaIngreso) {
      fechaIngreso = hoy;
      errores.push(`Fila ${idx + 2}: sin fecha de ingreso, se usó la fecha de hoy como provisoria (corregila en la ficha del empleado)`);
    }

    const sindicato = mapping.sindicato ? String(row[mapping.sindicato] ?? "").trim() || null : null;

    let obraId: string | null = null;
    if (mapping.obra) {
      const obraNombre = String(row[mapping.obra] ?? "").trim();
      if (obraNombre) {
        const match = obraByNombre.get(obraNombre.toLowerCase());
        if (match) {
          obraId = match;
        } else {
          errores.push(`Fila ${idx + 2}: obra "${obraNombre}" no encontrada, se dejó sin asignar`);
        }
      }
    }

    const data = { nombre, apellido, sindicato, valorHoraNormal, fechaIngreso, ...(obraId ? { obraId } : {}) };
    const existente = await prisma.employee.findUnique({ where: { legajo } });
    if (existente) {
      await prisma.employee.update({ where: { legajo }, data });
      actualizados += 1;
    } else {
      await prisma.employee.create({ data: { ...data, legajo } });
      creados += 1;
    }
  }

  cache.delete(token);
  res.json({ creados, actualizados, errores });
});

export default router;
