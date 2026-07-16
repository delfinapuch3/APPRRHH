import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

/** True si el error de Prisma es una violación de constraint único (ej. email repetido). */
function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

router.get("/", requireAdmin, async (_req, res) => {
  const usuarios = await prisma.user.findMany({
    include: { sectores: { include: { sector: true } } },
    orderBy: { nombre: "asc" },
  });
  res.json(
    usuarios.map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      apellido: u.apellido,
      role: u.role,
      activo: u.activo,
      sectores: u.sectores.map((s) => ({ id: s.sectorId, nombre: s.sector.nombre })),
    }))
  );
});

const usuarioSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nombre: z.string().min(1),
  apellido: z.string().min(1),
  role: z.enum(["ADMIN", "ENCARGADO"]),
  sectorIds: z.array(z.string()).optional(),
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = usuarioSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, nombre, apellido, role, sectorIds } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.user.create({
      data: {
        email,
        nombre,
        apellido,
        role,
        passwordHash,
        sectores: sectorIds ? { create: sectorIds.map((sectorId) => ({ sectorId })) } : undefined,
      },
    });
    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: "Ese email ya está en uso" });
    throw err;
  }
});

const usuarioUpdateSchema = z.object({
  email: z.string().email().optional(),
  nombre: z.string().min(1).optional(),
  apellido: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "ENCARGADO"]).optional(),
  activo: z.boolean().optional(),
  password: z.string().min(6).optional(),
  sectorIds: z.array(z.string()).optional(),
});

router.put("/:id", requireAdmin, async (req, res) => {
  const parsed = usuarioUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { password, sectorIds, ...rest } = parsed.data;

  // Guarda: un admin no puede quitarse a sí mismo el acceso de administrador.
  if (req.params.id === req.user!.id && (rest.activo === false || rest.role === "ENCARGADO")) {
    return res.status(400).json({ error: "No podés quitarte a vos mismo el acceso de administrador" });
  }

  const data: Record<string, unknown> = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  try {
    if (sectorIds) {
      await prisma.userSector.deleteMany({ where: { userId: req.params.id } });
      await prisma.userSector.createMany({ data: sectorIds.map((sectorId) => ({ userId: req.params.id, sectorId })) });
    }
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json({ id: user.id, email: user.email });
  } catch (err) {
    if (isUniqueViolation(err)) return res.status(409).json({ error: "Ese email ya está en uso" });
    throw err;
  }
});

router.delete("/:id", requireAdmin, async (req, res) => {
  const { id } = req.params;

  // Guarda: un admin no puede borrarse a sí mismo.
  if (id === req.user!.id) {
    return res.status(400).json({ error: "No podés borrarte a vos mismo" });
  }

  // Borrado seguro: bloquear si el usuario tiene registros asociados por FK
  // obligatoria (importaciones, ausencias cargadas o liquidaciones generadas).
  const [importaciones, ausencias, liquidaciones] = await Promise.all([
    prisma.importBatch.count({ where: { usuarioId: id } }),
    prisma.absence.count({ where: { cargadoPorId: id } }),
    prisma.payrollPeriod.count({ where: { generadoPorId: id } }),
  ]);
  if (importaciones + ausencias + liquidaciones > 0) {
    return res.status(409).json({
      error: "No se puede borrar: el usuario tiene registros asociados (importaciones, ausencias o liquidaciones). Desactivalo en su lugar.",
    });
  }

  await prisma.user.delete({ where: { id } });
  res.json({ ok: true });
});

export default router;
