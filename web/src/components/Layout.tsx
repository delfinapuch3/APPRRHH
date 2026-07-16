import { useEffect, useState, type ComponentType } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext.js";

type IconProps = { active?: boolean };

interface LeafItem {
  to: string;
  label: string;
  adminOnly: boolean;
  icon: ComponentType<IconProps>;
  children?: undefined;
}
interface ChildItem {
  to: string;
  label: string;
  icon: ComponentType<IconProps>;
  adminOnly?: boolean;
}
interface GroupItem {
  label: string;
  adminOnly: boolean;
  icon: ComponentType<IconProps>;
  children: ChildItem[];
  to?: undefined;
}
type NavItem = LeafItem | GroupItem;

const navItems: NavItem[] = [
  { to: "/dashboard", label: "Panel de control", adminOnly: false, icon: IconDash },
  {
    label: "Administración",
    adminOnly: false,
    icon: IconUsers,
    children: [
      { to: "/administracion/empleados", label: "Empleados", icon: IconUsers },
      { to: "/administracion/usuarios", label: "Usuarios", icon: IconKey, adminOnly: true },
      { to: "/administracion/jornadas", label: "Turnos", icon: IconClock, adminOnly: true },
      { to: "/administracion/feriados", label: "Feriados", icon: IconCalendar, adminOnly: true },
    ],
  },
  { to: "/analitico-personal", label: "Analítico de personal", adminOnly: false, icon: IconChart },
  {
    label: "Control",
    adminOnly: false,
    icon: IconClock,
    children: [
      { to: "/control/marcaciones", label: "Marcaciones", icon: IconCheck },
      { to: "/control/licencias", label: "Licencias", icon: IconFile },
      { to: "/control/ausencias", label: "Ausencias", icon: IconAlert },
    ],
  },
  {
    label: "Asistencia",
    adminOnly: false,
    icon: IconCheck,
    children: [
      { to: "/asistencia/periodo", label: "Por período", icon: IconCalendar },
      { to: "/asistencia/dia", label: "Por día", icon: IconClock },
    ],
  },
  {
    label: "Vacaciones",
    adminOnly: false,
    icon: IconSun,
    children: [
      { to: "/vacaciones/empleado", label: "Por empleado", icon: IconUsers },
      { to: "/vacaciones/historial", label: "Historial", icon: IconList },
    ],
  },
  { to: "/francos", label: "Francos", adminOnly: false, icon: IconCalendar },
  { to: "/liquidaciones", label: "Liquidaciones", adminOnly: true, icon: IconCash },
  { to: "/configuracion", label: "Configuración", adminOnly: true, icon: IconCog },
];

const SIDEBAR_COLAPSADO_KEY = "sidebarColapsado";

export function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [colapsado, setColapsado] = useState(() => localStorage.getItem(SIDEBAR_COLAPSADO_KEY) === "1");
  const [grupoAbierto, setGrupoAbierto] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLAPSADO_KEY, colapsado ? "1" : "0");
  }, [colapsado]);

  // Si la ruta actual pertenece a un grupo desplegable (ej. entré directo a
  // /control/licencias por un link externo), lo abre automáticamente.
  useEffect(() => {
    const grupoActivo = navItems.find((i) => i.children?.some((c) => c.to === location.pathname));
    if (grupoActivo) setGrupoAbierto(grupoActivo.label);
  }, [location.pathname]);

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
      <aside className={`sidebar${open ? " open" : ""}${colapsado ? " colapsado" : ""}`}>
        <div className="px-3 pt-5 pb-4 border-b border-sidebar-border text-center relative">
          <button
            onClick={() => setColapsado((v) => !v)}
            aria-label={colapsado ? "Mostrar panel lateral" : "Esconder panel lateral"}
            className={`hidden md:flex items-center justify-center absolute top-3 w-6 h-6 rounded text-sidebar-text hover:bg-sidebar-hover hover:text-white transition ${colapsado ? "right-1/2 translate-x-1/2" : "right-3"}`}
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            <svg
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24"
              style={{ transform: colapsado ? "rotate(180deg)" : "none" }}
            >
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {colapsado ? <LogoMark /> : <Logo width={140} />}
          {!colapsado && (
            <div className="mt-1.5 text-[10px] text-center uppercase tracking-[.06em] text-sidebar-text/70">
              Gestión de Operarios
            </div>
          )}
        </div>

        <nav className="flex-1 py-3 px-2.5 overflow-y-auto">
          {items.map((item) => {
            const Icon = item.icon;

            if (item.children) {
              const childrenVisibles = item.children.filter((c) => !c.adminOnly || isAdmin);
              const hijoActivo = childrenVisibles.some((c) => c.to === location.pathname);
              // Sin espacio para desplegar sub-ítems en el riel de íconos: un
              // click en el grupo entra directo a su primera página.
              if (colapsado) {
                return (
                  <NavLink
                    key={item.label}
                    to={childrenVisibles[0].to}
                    onClick={() => setOpen(false)}
                    title={item.label}
                    className={`nav-link${hijoActivo ? " active" : ""}`}
                  >
                    <Icon active={hijoActivo} />
                  </NavLink>
                );
              }
              const abierto = grupoAbierto === item.label;
              return (
                <div key={item.label}>
                  <button
                    type="button"
                    onClick={() => setGrupoAbierto(abierto ? null : item.label)}
                    className={`nav-link${hijoActivo ? " active" : ""}`}
                  >
                    <Icon active={hijoActivo} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    <svg
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                      style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform .15s" }}
                    >
                      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {abierto && (
                    <div>
                      {childrenVisibles.map((child) => (
                        <NavLink
                          key={child.to}
                          to={child.to}
                          onClick={() => setOpen(false)}
                          className={({ isActive }) => `nav-link-sub${isActive ? " active" : ""}`}
                        >
                          {({ isActive }) => (
                            <>
                              <child.icon active={isActive} />
                              <span>{child.label}</span>
                            </>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                title={colapsado ? item.label : undefined}
                className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}
              >
                {({ isActive }) => (
                  <>
                    <Icon active={isActive} />
                    {!colapsado && item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
        <div className="px-3 py-3 border-t border-sidebar-border">
          <NavLink
            to="/mi-cuenta"
            onClick={() => setOpen(false)}
            title={colapsado ? "Mi cuenta" : undefined}
            className={({ isActive }) =>
              `flex items-center gap-2.5 w-full px-3 py-2 rounded-lg mb-1 transition ${colapsado ? "justify-center" : ""} ${
                isActive ? "bg-sidebar-active text-white" : "text-sidebar-text hover:bg-sidebar-hover hover:text-slate-200"
              }`
            }
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" className="shrink-0">
              <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {!colapsado && (
              <div className="min-w-0 text-left">
                <div className="text-sm font-medium text-slate-200 truncate">{user?.nombre}</div>
                <div className="text-xs text-sidebar-text">
                  {user?.role === "ADMIN" ? "Administrador" : "Encargado de sector"}
                </div>
              </div>
            )}
          </NavLink>
          <button
            onClick={logout}
            title={colapsado ? "Cerrar sesión" : undefined}
            className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-sidebar-text hover:bg-sidebar-hover hover:text-slate-200 transition ${colapsado ? "justify-center" : ""}`}
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {!colapsado && "Cerrar sesión"}
          </button>
        </div>
      </aside>

      <main className={`main-content${colapsado ? " colapsado" : ""}`}>
        <div className="p-6 md:p-8 fade-up">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function Logo({ width = 150 }: { width?: number }) {
  return <img src="/logo.png" alt="POLYSAN S.A. / POLCECAL S.A." width={width} style={{ objectFit: "contain" }} />;
}

function LogoMark() {
  return (
    <div className="w-8 h-8 mx-auto rounded-lg bg-white/95 flex items-center justify-center overflow-hidden">
      <img src="/logo.png" alt="POLYSAN S.A. / POLCECAL S.A." style={{ width: 24, height: 24, objectFit: "contain" }} />
    </div>
  );
}

/* ─── Nav Icons ─── */
function stroke(active?: boolean) {
  return active ? "#46B869" : "#475569";
}

function IconDash({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
    </svg>
  );
}
function IconChart({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M3 3v18h18M8 17V10m5 7V6m5 11v-4" strokeLinecap="round" strokeLinejoin="round" />
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
function IconKey({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <circle cx="7" cy="15" r="3" />
      <path d="M9.5 12.5L19 3m-4 4l2 2m-5 1l2 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconFile({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M7 3h7l5 5v13a1 1 0 01-1 1H7a1 1 0 01-1-1V4a1 1 0 011-1z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 3v5h5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function IconAlert({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <path
        d="M12 9v4m0 4h.01M10.29 3.86l-8.18 14.18A2 2 0 004 21h16a2 2 0 001.89-2.96L13.71 3.86a2 2 0 00-3.42 0z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconList({ active }: IconProps) {
  return (
    <svg width="16" height="16" fill="none" stroke={stroke(active)} strokeWidth="1.5" viewBox="0 0 24 24">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" strokeLinecap="round" strokeLinejoin="round" />
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
