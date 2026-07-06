import { Router } from "express";
import { prisma } from "../db.js";
import { obraScope } from "../middleware/auth.js";
import { recalcularObraPeriodo } from "../engine/recalcular.js";

const router = Router();

function parseRange(req: import("express").Request) {
  const { desde, hasta } = req.query as Record<string, string | undefined>;
  const hoy = new Date();
  const fechaHasta = hasta ? new Date(hasta) : hoy;
  const fechaDesde = desde ? new Date(desde) : new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  return { fechaDesde, fechaHasta };
}

router.get("/resumen", async (req, res) => {
  const scope = obraScope(req);
  const { obraId } = req.query as Record<string, string | undefined>;
  const { fechaDesde, fechaHasta } = parseRange(req);

  const effectiveObraId = scope ? (scope.includes(obraId ?? "") ? obraId! : scope[0] ?? null) : obraId ?? null;
  if (scope) {
    await recalcularObraPeriodo(effectiveObraId, fechaDesde, fechaHasta);
  } else {
    await recalcularObraPeriodo(obraId ?? null, fechaDesde, fechaHasta);
  }

  const empleados = await prisma.employee.findMany({
    where: {
      activo: true,
      ...(scope ? { obraId: { in: scope } } : obraId ? { obraId } : {}),
    },
  });

  const empleadoIds = empleados.map((e) => e.id);
  const calculos = await prisma.dailyCalculation.findMany({
    where: { employeeId: { in: empleadoIds }, fecha: { gte: fechaDesde, lte: fechaHasta } },
  });

  const porEmpleado = empleados.map((emp) => {
    const dias = calculos.filter((c) => c.employeeId === emp.id);
    const diasEsperados = dias.filter((d) => d.tipoDia !== "DOMINGO").length;
    const ausenciasInjustificadas = dias.filter((d) => d.ausente && d.justificada === false).length;
    const ausenciasSinClasificar = dias.filter((d) => d.ausente && d.justificada === null).length;
    const ausenciasJustificadas = dias.filter((d) => d.ausente && d.justificada === true).length;
    const presentes = diasEsperados - ausenciasInjustificadas - ausenciasSinClasificar - ausenciasJustificadas;
    const porcentajeAsistencia = diasEsperados > 0 ? Math.round(((presentes + ausenciasJustificadas) / diasEsperados) * 1000) / 10 : 100;

    return {
      employeeId: emp.id,
      legajo: emp.legajo,
      nombre: `${emp.apellido}, ${emp.nombre}`,
      diasEsperados,
      presentes,
      ausenciasJustificadas,
      ausenciasInjustificadas,
      ausenciasSinClasificar,
      porcentajeAsistencia,
    };
  });

  const totalDiasEsperados = porEmpleado.reduce((a, e) => a + e.diasEsperados, 0);
  const totalPresentesOJustificados = porEmpleado.reduce((a, e) => a + e.presentes + e.ausenciasJustificadas, 0);
  const porcentajeGeneral = totalDiasEsperados > 0 ? Math.round((totalPresentesOJustificados / totalDiasEsperados) * 1000) / 10 : 100;

  res.json({ fechaDesde, fechaHasta, porcentajeGeneral, empleados: porEmpleado });
});

router.get("/faltas-sin-clasificar", async (req, res) => {
  const scope = obraScope(req);
  const { fechaDesde, fechaHasta } = parseRange(req);

  const empleados = await prisma.employee.findMany({
    where: { activo: true, ...(scope ? { obraId: { in: scope } } : {}) },
    select: { id: true },
  });

  const faltas = await prisma.dailyCalculation.findMany({
    where: {
      employeeId: { in: empleados.map((e) => e.id) },
      fecha: { gte: fechaDesde, lte: fechaHasta },
      ausente: true,
      justificada: null,
    },
    include: { employee: true },
    orderBy: { fecha: "desc" },
  });

  res.json(faltas);
});

export default router;
