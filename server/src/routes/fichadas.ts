import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { sectorScope } from "../middleware/auth.js";
import { recalcularEmpleadoPeriodo } from "../engine/recalcular.js";
import { sendXlsx } from "../lib/xlsxExport.js";

const router = Router();

function buildWhere(req: import("express").Request) {
  const scope = sectorScope(req);
  const { employeeId, desde, hasta } = req.query as Record<string, string | undefined>;
  const where: Record<string, unknown> = {};
  if (employeeId) where.employeeId = employeeId;
  if (desde || hasta) {
    where.fecha = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }
  if (scope) {
    where.employee = { sectorId: { in: scope } };
  }
  return where;
}

router.get("/", async (req, res) => {
  const fichadas = await prisma.timeRecord.findMany({
    where: buildWhere(req),
    include: { employee: true },
    orderBy: { fecha: "desc" },
    take: 500,
  });
  res.json(fichadas);
});

router.get("/export.xlsx", async (req, res) => {
  const fichadas = await prisma.timeRecord.findMany({
    where: buildWhere(req),
    include: { employee: true },
    orderBy: { fecha: "desc" },
  });
  const rows = [
    ["Legajo", "Empleado", "Fecha", "Hora entrada", "Hora salida", "Origen"],
    ...fichadas.map((f) => [
      f.employee.legajo,
      `${f.employee.apellido}, ${f.employee.nombre}`,
      f.fecha.toLocaleDateString("es-AR", { timeZone: "UTC" }),
      f.horaEntrada.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }),
      f.horaSalida ? f.horaSalida.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "",
      f.origen,
    ]),
  ];
  sendXlsx(res, "fichadas.xlsx", "Fichadas", rows);
});

const fichadaSchema = z.object({
  employeeId: z.string().min(1),
  fecha: z.coerce.date(),
  horaEntrada: z.coerce.date(),
  horaSalida: z.coerce.date().nullable().optional(),
  observaciones: z.string().optional(),
});

router.post("/", async (req, res) => {
  const parsed = fichadaSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const fichada = await prisma.timeRecord.create({
    data: { ...parsed.data, origen: "MANUAL" },
  });
  await recalcularEmpleadoPeriodo(fichada.employeeId, fichada.fecha, fichada.fecha);
  res.status(201).json(fichada);
});

router.put("/:id", async (req, res) => {
  const parsed = fichadaSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const fichada = await prisma.timeRecord.update({ where: { id: req.params.id }, data: parsed.data });
  await recalcularEmpleadoPeriodo(fichada.employeeId, fichada.fecha, fichada.fecha);
  res.json(fichada);
});

router.delete("/:id", async (req, res) => {
  const fichada = await prisma.timeRecord.delete({ where: { id: req.params.id } });
  await recalcularEmpleadoPeriodo(fichada.employeeId, fichada.fecha, fichada.fecha);
  res.status(204).end();
});

export default router;
