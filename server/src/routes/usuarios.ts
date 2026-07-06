import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", requireAdmin, async (_req, res) => {
  const usuarios = await prisma.user.findMany({
    include: { obras: { include: { obra: true } } },
    orderBy: { nombre: "asc" },
  });
  res.json(
    usuarios.map((u) => ({
      id: u.id,
      email: u.email,
      nombre: u.nombre,
      role: u.role,
      activo: u.activo,
      obras: u.obras.map((o) => ({ id: o.obraId, nombre: o.obra.nombre })),
    }))
  );
});

const usuarioSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  nombre: z.string().min(1),
  role: z.enum(["ADMIN", "ENCARGADO"]),
  obraIds: z.array(z.string()).optional(),
});

router.post("/", requireAdmin, async (req, res) => {
  const parsed = usuarioSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { email, password, nombre, role, obraIds } = parsed.data;
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      nombre,
      role,
      passwordHash,
      obras: obraIds ? { create: obraIds.map((obraId) => ({ obraId })) } : undefined,
    },
  });
  res.status(201).json({ id: user.id, email: user.email });
});

const usuarioUpdateSchema = z.object({
  nombre: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "ENCARGADO"]).optional(),
  activo: z.boolean().optional(),
  password: z.string().min(6).optional(),
  obraIds: z.array(z.string()).optional(),
});

router.put("/:id", requireAdmin, async (req, res) => {
  const parsed = usuarioUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { password, obraIds, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (password) data.passwordHash = await bcrypt.hash(password, 10);

  if (obraIds) {
    await prisma.userObra.deleteMany({ where: { userId: req.params.id } });
    await prisma.userObra.createMany({ data: obraIds.map((obraId) => ({ userId: req.params.id, obraId })) });
  }
  const user = await prisma.user.update({ where: { id: req.params.id }, data });
  res.json({ id: user.id, email: user.email });
});

export default router;
