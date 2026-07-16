import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, signToken } from "../middleware/auth.js";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Datos inválidos" });
  }
  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email }, include: { sectores: true } });
  if (!user || !user.activo) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return res.status(401).json({ error: "Credenciales inválidas" });
  }
  const token = signToken(user.id);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role,
      sectorIds: user.sectores.map((s) => s.sectorId),
    },
  });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6),
});

router.post("/change-password", requireAuth, async (req, res) => {
  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "La nueva contraseña debe tener al menos 6 caracteres" });
  }
  const { currentPassword, newPassword } = parsed.data;
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) return res.status(400).json({ error: "La contraseña actual es incorrecta" });

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
  res.json({ ok: true });
});

export default router;
