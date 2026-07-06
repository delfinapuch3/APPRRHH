import { randomUUID } from "node:crypto";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";
import { parseNumeroAR, parseWorkbook, toDateOnlyFromCell } from "../lib/excelImport.js";

const router = Router();
router.use(requireAdmin);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

interface CachedImport {
  rows: Record<string, unknown>[];
  headers: string[];
  expiresAt: number;
}
const cache = new Map<string, CachedImport>();

function cleanupCache() {
  const now = Date.now();
  for (const [token, entry] of cache) {
    if (entry.expiresAt < now) cache.delete(token);
  }
}

router.post("/preview", upload.single("file"), (req, res) => {
  cleanupCache();
  if (!req.file) return res.status(400).json({ error: "Falta el archivo" });
  try {
    const { rows, headers } = parseWorkbook(req.file.buffer);
    if (rows.length === 0) return res.status(400).json({ error: "El archivo no tiene filas" });
    const token = randomUUID();
    cache.set(token, { rows, headers, expiresAt: Date.now() + 15 * 60 * 1000 });
    res.json({ token, headers, sample: rows.slice(0, 15), totalRows: rows.length });
  } catch {
    res.status(400).json({ error: "No se pudo leer el archivo. Verificá que sea .xlsx o .csv" });
  }
});

const confirmSchema = z.object({
  token: z.string(),
  mapping: z.object({
    legajo: z.string(),
    nombre: z.string(),
    apellido: z.string(),
    valorHoraNormal: z.string(),
    fechaIngreso: z.string(),
    sindicato: z.string().optional(),
    obra: z.string().optional(),
  }),
});

router.post("/confirm", async (req, res) => {
  const parsed = confirmSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { token, mapping } = parsed.data;
  const entry = cache.get(token);
  if (!entry) return res.status(400).json({ error: "La vista previa expiró, volvé a subir el archivo" });

  const obras = await prisma.obra.findMany();
  const obraByNombre = new Map(obras.map((o) => [o.nombre.trim().toLowerCase(), o.id]));

  const errores: string[] = [];
  let creados = 0;
  let actualizados = 0;

  for (let idx = 0; idx < entry.rows.length; idx++) {
    const row = entry.rows[idx];
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
    const fechaIngreso = toDateOnlyFromCell(row[mapping.fechaIngreso]);
    if (!fechaIngreso) {
      errores.push(`Fila ${idx + 2}: fecha de ingreso inválida`);
      continue;
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
