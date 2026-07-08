import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login.js";
import { Layout } from "./components/Layout.js";
import { ProtectedRoute, AdminRoute } from "./components/ProtectedRoute.js";
import Dashboard from "./pages/Dashboard.js";
import Administracion from "./pages/Administracion.js";
import EmpleadoDetalle from "./pages/EmpleadoDetalle.js";
import Fichadas from "./pages/Fichadas.js";
import Asistencia from "./pages/Asistencia.js";
import Vacaciones from "./pages/Vacaciones.js";
import Francos from "./pages/Francos.js";
import Liquidaciones from "./pages/Liquidaciones.js";
import Configuracion from "./pages/Configuracion.js";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/administracion" element={<Administracion />} />
          <Route path="/empleados/:id" element={<EmpleadoDetalle />} />
          <Route path="/fichadas" element={<Fichadas />} />
          <Route path="/asistencia" element={<Asistencia />} />
          <Route path="/vacaciones" element={<Vacaciones />} />
          <Route path="/francos" element={<Francos />} />
          <Route element={<AdminRoute />}>
            <Route path="/liquidaciones" element={<Liquidaciones />} />
            <Route path="/configuracion" element={<Configuracion />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
