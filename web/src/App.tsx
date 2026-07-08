import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login.js";
import { Layout } from "./components/Layout.js";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute.js";
import Dashboard from "./pages/Dashboard.js";
import Empleados from "./pages/Empleados.js";
import AdministracionUsuarios from "./pages/AdministracionUsuarios.js";
import AdministracionJornadas from "./pages/AdministracionJornadas.js";
import AdministracionFeriados from "./pages/AdministracionFeriados.js";
import EmpleadoDetalle from "./pages/EmpleadoDetalle.js";
import Fichadas from "./pages/Fichadas.js";
import Licencias from "./pages/Licencias.js";
import Ausencias from "./pages/Ausencias.js";
import AsistenciaPeriodo from "./pages/AsistenciaPeriodo.js";
import AsistenciaDia from "./pages/AsistenciaDia.js";
import Vacaciones from "./pages/Vacaciones.js";
import VacacionesHistorial from "./pages/VacacionesHistorial.js";
import Francos from "./pages/Francos.js";
import Liquidaciones from "./pages/Liquidaciones.js";
import Configuracion from "./pages/Configuracion.js";
import AnaliticoPersonal from "./pages/AnaliticoPersonal.js";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
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
  );
}
