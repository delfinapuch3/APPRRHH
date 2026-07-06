import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

const navItems = [
  { to: "/dashboard", label: "Dashboard", adminOnly: false },
  { to: "/empleados", label: "Empleados", adminOnly: false },
  { to: "/fichadas", label: "Fichadas", adminOnly: false },
  { to: "/asistencia", label: "Asistencia", adminOnly: false },
  { to: "/vacaciones", label: "Vacaciones", adminOnly: false },
  { to: "/francos", label: "Francos", adminOnly: false },
  { to: "/liquidaciones", label: "Liquidaciones", adminOnly: true },
  { to: "/configuracion", label: "Configuración", adminOnly: true },
];

export function Layout() {
  const { user, logout, isAdmin } = useAuth();

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-60 bg-slate-900 text-slate-100 flex flex-col">
        <div className="px-4 py-5 text-lg font-semibold border-b border-slate-700">
          Gestión de Operarios
        </div>
        <nav className="flex-1 py-4">
          {navItems
            .filter((i) => !i.adminOnly || isAdmin)
            .map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `block px-4 py-2 text-sm rounded-md mx-2 mb-1 ${
                    isActive ? "bg-slate-700 text-white" : "text-slate-300 hover:bg-slate-800"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
        </nav>
        <div className="p-4 border-t border-slate-700 text-sm">
          <div className="font-medium">{user?.nombre}</div>
          <div className="text-slate-400">{user?.role === "ADMIN" ? "Administrador" : "Encargado de sector"}</div>
          <button onClick={logout} className="mt-2 text-slate-400 hover:text-white underline">
            Cerrar sesión
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
