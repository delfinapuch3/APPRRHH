import "dotenv/config";
import cors from "cors";
import express from "express";
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
import { requireAuth } from "./middleware/auth.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
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

const port = process.env.PORT ? Number(process.env.PORT) : 4000;
app.listen(port, () => {
  console.log(`Server escuchando en http://localhost:${port}`);
});
