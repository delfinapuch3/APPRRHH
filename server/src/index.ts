import "dotenv/config";
import "express-async-errors";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { Prisma } from "@prisma/client";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import express from "express";
import type { NextFunction, Request, Response } from "express";
import { prisma } from "./db.js";
import authRouter from "./routes/auth.js";
import empleadosRouter from "./routes/empleados.js";
import importEmpleadosRouter from "./routes/importEmpleados.js";
import sectoresRouter from "./routes/sectores.js";
import empresasRouter from "./routes/empresas.js";
import fichadasRouter from "./routes/fichadas.js";
import importFichadasRouter from "./routes/importFichadas.js";
import ausenciasRouter from "./routes/ausencias.js";
import vacacionesRouter from "./routes/vacaciones.js";
import francosRouter from "./routes/francos.js";
import liquidacionesRouter from "./routes/liquidaciones.js";
import configuracionRouter from "./routes/configuracion.js";
import asistenciaRouter from "./routes/asistencia.js";
import dashboardRouter from "./routes/dashboard.js";
import usuariosRouter from "./routes/usuarios.js";
import jornadasRouter from "./routes/jornadas.js";
import analiticoRouter from "./routes/analitico.js";
import { requireAuth } from "./middleware/auth.js";

// En producción, cortar el arranque si faltan variables de entorno críticas,
// para no correr con un JWT_SECRET débil por defecto ni sin base de datos.
const isProd = process.env.NODE_ENV === "production";
if (isProd) {
  const faltantes = ["DATABASE_URL", "JWT_SECRET"].filter((k) => !process.env[k]);
  if (faltantes.length > 0) {
    console.error(`Faltan variables de entorno obligatorias en producción: ${faltantes.join(", ")}`);
    process.exit(1);
  }
}

const app = express();
// Detrás del proxy de Render: necesario para que el rate limiter vea la IP real.
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));

// CORS: por defecto solo se permite el propio origen (el server sirve el
// frontend, así que no hace falta CORS abierto). En dev se permiten los
// puertos de Vite. Configurable con CORS_ORIGIN (lista separada por comas).
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:5174"];
app.use(cors({ origin: corsOrigins }));
app.use(express.json());

// Rate limiting en autenticación: frena ataques de fuerza bruta al login.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20, // 20 intentos por IP por ventana
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Probá de nuevo en unos minutos." },
});

app.get("/api/health", (_req, res) => res.json({ ok: true }));

// Readiness: verifica que la base responda (para monitoreo/uptime real).
app.get("/api/ready", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ ok: true, db: "up" });
  } catch {
    res.status(503).json({ ok: false, db: "down" });
  }
});

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/empleados/import", requireAuth, importEmpleadosRouter);
app.use("/api/empleados", requireAuth, empleadosRouter);
app.use("/api/sectores", requireAuth, sectoresRouter);
app.use("/api/empresas", requireAuth, empresasRouter);
app.use("/api/fichadas/import", requireAuth, importFichadasRouter);
app.use("/api/fichadas", requireAuth, fichadasRouter);
app.use("/api/ausencias", requireAuth, ausenciasRouter);
app.use("/api/vacaciones", requireAuth, vacacionesRouter);
app.use("/api/francos", requireAuth, francosRouter);
app.use("/api/liquidaciones", requireAuth, liquidacionesRouter);
app.use("/api/configuracion", requireAuth, configuracionRouter);
app.use("/api/asistencia", requireAuth, asistenciaRouter);
app.use("/api/dashboard", requireAuth, dashboardRouter);
app.use("/api/usuarios", requireAuth, usuariosRouter);
app.use("/api/jornadas", requireAuth, jornadasRouter);
app.use("/api/analitico", requireAuth, analiticoRouter);

// En producción, este mismo servidor sirve el frontend ya compilado
// (web/dist), para que todo corra como un solo servicio con una sola URL.
// En desarrollo web/dist no existe (se usa `vite dev` aparte) así que esto
// no hace nada.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.join(__dirname, "../../web/dist");
if (fs.existsSync(webDist)) {
  app.use(express.static(webDist));
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(webDist, "index.html"));
  });
}

// Manejador de errores global: sin esto, cualquier error sin capturar en una
// ruta async (ej. borrar un registro que ya no existe) tumba todo el
// servidor en vez de responder con un error HTTP normal.
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "El registro ya no existe (puede que otra persona lo haya borrado)." });
    }
    if (err.code === "P2002") {
      return res.status(409).json({ error: "Ya existe un registro con ese valor." });
    }
  }
  console.error(err);
  res.status(500).json({ error: "Ocurrió un error inesperado en el servidor." });
});

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Server escuchando en http://localhost:${port}`);
});
