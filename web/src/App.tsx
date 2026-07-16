import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login.js";
import { Layout } from "./components/Layout.js";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute.js";

// Carga diferida de las páginas: cada una queda en su propio chunk, así el
// bundle inicial es chico y las libs pesadas (recharts, xlsx) solo se bajan
// cuando el usuario entra a la página que las usa.
const Dashboard = lazy(() => import("./pages/Dashboard.js"));
const Empleados = lazy(() => import("./pages/Empleados.js"));
const AdministracionUsuarios = lazy(() => import("./pages/AdministracionUsuarios.js"));
const AdministracionJornadas = lazy(() => import("./pages/AdministracionJornadas.js"));
const AdministracionFeriados = lazy(() => import("./pages/AdministracionFeriados.js"));
const EmpleadoDetalle = lazy(() => import("./pages/EmpleadoDetalle.js"));
const Fichadas = lazy(() => import("./pages/Fichadas.js"));
const Licencias = lazy(() => import("./pages/Licencias.js"));
const Ausencias = lazy(() => import("./pages/Ausencias.js"));
const AsistenciaPeriodo = lazy(() => import("./pages/AsistenciaPeriodo.js"));
const AsistenciaDia = lazy(() => import("./pages/AsistenciaDia.js"));
const Vacaciones = lazy(() => import("./pages/Vacaciones.js"));
const VacacionesHistorial = lazy(() => import("./pages/VacacionesHistorial.js"));
const Francos = lazy(() => import("./pages/Francos.js"));
const Liquidaciones = lazy(() => import("./pages/Liquidaciones.js"));
const Configuracion = lazy(() => import("./pages/Configuracion.js"));
const AnaliticoPersonal = lazy(() => import("./pages/AnaliticoPersonal.js"));
const MiCuenta = lazy(() => import("./pages/MiCuenta.js"));

function Cargando() {
  return <div className="p-8 text-sm text-ink-muted">Cargando…</div>;
}

export default function App() {
  return (
    <Suspense fallback={<Cargando />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/mi-cuenta" element={<MiCuenta />} />
            <Route path="/administracion/empleados" element={<Empleados />} />
            <Route path="/empleados/:id" element={<EmpleadoDetalle />} />
            <Route path="/analitico-personal" element={<AnaliticoPersonal />} />
            <Route path="/control/marcaciones" element={<Fichadas />} />
            <Route path="/control/licencias" element={<Licencias />} />
            <Route path="/control/ausencias" element={<Ausencias />} />
            <Route path="/asistencia/periodo" element={<AsistenciaPeriodo />} />
            <Route path="/asistencia/dia" element={<AsistenciaDia />} />
            <Route path="/vacaciones/empleado" element={<Vacaciones />} />
            <Route path="/vacaciones/historial" element={<VacacionesHistorial />} />
            <Route path="/francos" element={<Francos />} />
            <Route element={<AdminRoute />}>
              <Route path="/administracion/usuarios" element={<AdministracionUsuarios />} />
              <Route path="/administracion/jornadas" element={<AdministracionJornadas />} />
              <Route path="/administracion/feriados" element={<AdministracionFeriados />} />
              <Route path="/liquidaciones" element={<Liquidaciones />} />
              <Route path="/configuracion" element={<Configuracion />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
