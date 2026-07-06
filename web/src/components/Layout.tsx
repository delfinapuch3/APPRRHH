import { useState, type ComponentType } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

type IconProps = { active?: boolean };

const navItems: {
  to: string;
  label: string;
  adminOnly: boolean;
  icon: ComponentType<IconProps>;
}[] = [
  { to: "/dashboard", label: "Dashboard", adminOnly: false, icon: IconDash },
  { to: "/empleados", label: "Empleados", adminOnly: false, icon: IconUsers },
  { to: "/fichadas", label: "Fichadas", adminOnly: false, icon: IconClock },
  { to: "/asistencia", label: "Asistencia", adminOnly: false, icon: IconCheck },
  { to: "/vacaciones", label: "Vacaciones", adminOnly: false, icon: IconSun },
  { to: "/francos", label: "Francos", adminOnly: false, icon: IconCalendar },
  { to: "/liquidaciones", label: "Liquidaciones", adminOnly: true, icon: IconCash },
  { to: "/configuracion", label: "Configuración", adminOnly: true, icon: IconCog },
];

export function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);

  const items = navItems.filter((i) => !i.adminOnly || isAdmin);

  return (
    <div className="app-shell">
      {/* Mobile topbar */}
      <div className="mobile-topbar">
        <Logo width={120} />
        <button
          onClick={() => setOpen(true)}
          className="text-sidebar-text"
          style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
          aria-label="Abrir menú"
        >
          <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Overlay */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 39 }}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar${open ? " open" : ""}`}>
        <div className="px-4 pt-5 pb-4 border-b border-sidebar-border">
          <Logo width={150} />
          <div className="mt-1.5 text-[10px] text-center uppercase tracking-[.06em] text-sidebar-text/70">
            Gestión de Operarios
          </div>
        </div>

        <nav className="flex-1 py-3 px-2.5 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                {({ isActive }) => (
                  <>
                    <Icon active={isActive} />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="px-2 mb-2">
            <div className="text-sm font-medium text-slate-200 truncate">{user?.nombre}</div>
            <div className="text-xs text-sidebar-text">
              {user?.role === "ADMIN" ? "Administrador" : "Encargado de obra"}
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-sidebar-text hover:bg-sidebar-hover hover:text-slate-200 transition"
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="main-content">
        <div className="p-6 md:p-8 fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Logo({ width = 150 }: { width?: number }) {
  return <img src="/logo.svg" alt="POLYSAN / POLCECAL" width={width} style={{ objectFit: "contain" }} />;
}

/* ─── Nav Icons ─── */
function stroke(active?: boolean) {
  return active ? "#F59E0B" : "#475569";
}

function IconDash({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconUsers({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconClock({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCheck({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconSun({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCalendar({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCash({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m3-4a3 3 0 116 0 3 3 0 01-6 0zm11 0a2 2 0 01-2 2h-6a2 2 0 01-2-2v-2a2 2 0 012-2h6a2 2 0 012 2v2z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconCog({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
