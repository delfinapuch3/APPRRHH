import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { sectorScope } from "../middleware/auth.js";
import { sendXlsx } from "../lib/xlsxExport.js";

const router = Router();

function buildWhere(req: import("express").Request) {
  const scope = sectorScope(req);
  const { employeeId, estado } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (estado) where.estado = estado;
  if (scope) where.employee = { sectorId: { in: scope } };
  return where;
}

router.get("/", async (req, res) => {
  const francos = await prisma.francoCompensatorio.findMany({
    where: buildWhere(req),
    include: { employee: true },
    orderBy: { fechaGenerado: "desc" },
  });
  res.json(francos);
});

router.get("/export.xlsx", async (req, res) => {
  const francos = await prisma.francoCompensatorio.findMany({
    where: buildWhere(req),
    include: { employee: true },
    orderBy: { fechaGenerado: "desc" },
  });
  const rows = [
    ["Legajo", "Empleado", "Generado", "Horas", "Estado", "Tomado el"],
    ...francos.map((f) => [
      f.employee.legajo,
      `${f.employee.apellido}, ${f.employee.nombre}`,
      f.fechaGenerado.toLocaleDateString("es-AR", { timeZone: "UTC" }),
      f.horas,
      f.estado,
      f.fechaTomado ? f.fechaTomado.toLocaleDateString("es-AR", { timeZone: "UTC" }) : "",
    ]),
  ];
  sendXlsx(res, "francos.xlsx", "Francos", rows);
});

const updateSchema = z.object({
  estado: z.enum(["PENDIENTE", "TOMADO"]),
  fechaTomado: z.coerce.date().optional(),
});

router.put("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const franco = await prisma.francoCompensatorio.update({
    where: { id: req.params.id },
    data: parsed.data,
  });
  res.json(franco);
});

export default router;
