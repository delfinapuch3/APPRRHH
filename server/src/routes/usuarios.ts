import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

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
});

const usuarioUpdateSchema = z.object({
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
  const data: Record<string, unknown> = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  if (sectorIds) {
    await prisma.userSector.deleteMany({ where: { userId: req.params.id } });
    await prisma.userSector.createMany({ data: sectorIds.map((sectorId) => ({ userId: req.params.id, sectorId })) });
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json({ id: user.id, email: user.email });
});

export default router;
