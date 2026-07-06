import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { prisma } from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret-change-in-production-please";

export interface AuthUser {
  id: string;
  email: string;
  nombre: string;
  role: "ADMIN" | "ENCARGADO";
  sectorIds: string[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: "12h" });
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No autenticado" });
  }
  try {
    const token = header.slice("Bearer ".length);
    const payload = jwt.verify(token, JWT_SECRET) as { sub: string };
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: { sectores: true },
    });
    if (!user || !user.activo) {
      return res.status(401).json({ error: "No autenticado" });
    }
    req.user = {
      id: user.id,
      email: user.email,
      nombre: user.nombre,
      role: user.role,
      sectorIds: user.sectores.map((s) => s.sectorId),
    };
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    return res.status(403).json({ error: "Requiere rol de administrador" });
  }
  next();
}

/** Para ENCARGADO: fuerza a filtrar por sus sectores asignados. ADMIN no tiene restricción (retorna null = sin filtro). */
export function sectorScope(req: Request): string[] | null {
  if (req.user?.role === "ADMIN") return null;
  return req.user?.sectorIds ?? [];
}
