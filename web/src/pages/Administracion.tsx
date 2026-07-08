import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";
import Empleados from "./Empleados.js";

const TABS = ["empleados", "usuarios", "horarios"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  empleados: "Empleados",
  usuarios: "Usuarios",
  horarios: "Horarios",
};

export default function Administracion() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<Tab>("empleados");

  const tabsVisibles = TABS.filter((t) => t === "empleados" || isAdmin);

  return (
    <div>
      <h1 className="page-header mb-6">Administración</h1>

      <div className="flex gap-2 mb-6">
        {tabsVisibles.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm ${tab === t ? "bg-primary text-white" : "bg-white text-slate-600"}`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "empleados" && <Empleados />}
      {tab === "usuarios" && isAdmin && <UsuariosTab />}
      {tab === "horarios" && isAdmin && <HorariosTab />}
    </div>
  );
}

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  role: "ADMIN" | "ENCARGADO";
  activo: boolean;
}

function UsuariosTab() {
  const queryClient = useQueryClient();
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => (await api.get("/usuarios")).data as Usuario[],
  });

  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", password: "", role: "ENCARGADO" });
  const crear = useMutation({
    mutationFn: async () => api.post("/usuarios", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      setForm({ nombre: "", apellido: "", email: "", password: "", role: "ENCARGADO" });
    },
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; activo?: boolean; role?: string }) => api.put(`/usuarios/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="card p-5 col-span-1">
        <h2 className="font-medium text-slate-700 mb-3">Nuevo usuario</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            crear.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nombre</label>
            <input
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Apellido</label>
            <input
              required
              value={form.apellido}
              onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            >
              <option value="ENCARGADO">Encargado de sector</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Email de acceso</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={crear.isPending}
            className="w-full bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50"
          >
            {crear.isPending ? "Creando..." : "Crear usuario"}
          </button>
          {crear.isError && <p className="text-sm text-red-600">No se pudo crear el usuario (¿email repetido?)</p>}
        </form>
      </div>

      <div className="card p-5 col-span-2">
        <h2 className="font-medium text-slate-700 mb-3">Usuarios del sistema</h2>
        {isLoading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Email</th>
                <th className="pb-2">Rol</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {usuarios?.map((u) => (
                <tr key={u.id} className={`border-b last:border-0 ${!u.activo ? "opacity-50" : ""}`}>
                  <td className="py-2">
                    {u.apellido ? `${u.apellido}, ${u.nombre}` : u.nombre}
                  </td>
                  <td className="py-2">{u.email}</td>
                  <td className="py-2">
                    <select
                      value={u.role}
                      onChange={(e) => actualizar.mutate({ id: u.id, role: e.target.value })}
                      className="border border-slate-300 rounded-md px-2 py-1 text-xs"
                    >
                      <option value="ENCARGADO">Encargado</option>
                      <option value="ADMIN">Administrador</option>
                    </select>
                  </td>
                  <td className="py-2">{u.activo ? "Activo" : "Inactivo"}</td>
                  <td className="py-2 text-right">
                    <button
                      onClick={() => actualizar.mutate({ id: u.id, activo: !u.activo })}
                      className="text-slate-700 underline text-sm"
                    >
                      {u.activo ? "Dar de baja" : "Reactivar"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface Jornada {
  id: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  redondeoMinutos: number;
  toleranciaMinutos: number;
  activo: boolean;
}

interface Feriado {
  id: string;
  fecha: string;
  nombre: string;
}

function HorariosTab() {
  const [sub, setSub] = useState<"jornadas" | "feriados">("jornadas");
  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSub("jornadas")}
          className={`px-3 py-1.5 rounded-md text-sm ${sub === "jornadas" ? "bg-primary text-white" : "bg-white text-slate-600"}`}
        >
          Jornadas
        </button>
        <button
          onClick={() => setSub("feriados")}
          className={`px-3 py-1.5 rounded-md text-sm ${sub === "feriados" ? "bg-primary text-white" : "bg-white text-slate-600"}`}
        >
          Feriados
        </button>
      </div>
      {sub === "jornadas" ? <JornadasPanel /> : <FeriadosPanel />}
    </div>
  );
}

function JornadasPanel() {
  const queryClient = useQueryClient();
  const { data: jornadas, isLoading } = useQuery({
    queryKey: ["jornadas"],
    queryFn: async () => (await api.get("/jornadas")).data as Jornada[],
  });

  const [form, setForm] = useState({
    nombre: "",
    horaInicio: "08:00",
    horaFin: "16:00",
    redondeoMinutos: "0",
    toleranciaMinutos: "0",
  });
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () =>
      api.post("/jornadas", {
        nombre: form.nombre,
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        redondeoMinutos: Number(form.redondeoMinutos),
        toleranciaMinutos: Number(form.toleranciaMinutos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jornadas"] });
      setForm({ nombre: "", horaInicio: "08:00", horaFin: "16:00", redondeoMinutos: "0", toleranciaMinutos: "0" });
    },
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => api.delete(`/jornadas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jornadas"] });
      setError(null);
    },
    onError: (err: any) => setError(err?.response?.data?.error ?? "No se pudo eliminar la jornada"),
  });

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="card p-5 col-span-1">
        <h2 className="font-medium text-slate-700 mb-3">Nueva jornada</h2>
        <p className="text-xs text-slate-500 mb-3">
          Ej. Oficina 08:00 a 16:00, o turnos rotativos 04:00-12:00 / 12:00-20:00 / 20:00-04:00.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            crear.mutate();
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs text-slate-500 mb-1">Nombre</label>
            <input
              required
              placeholder="Oficina, Turno mañana..."
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Hora inicio</label>
              <input
                type="time"
                required
                value={form.horaInicio}
                onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Hora fin</label>
              <input
                type="time"
                required
                value={form.horaFin}
                onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Redondeo (minutos) <span className="text-slate-400">— ej. 60 = redondea 7.9hs a 8hs</span>
            </label>
            <input
              type="number"
              min={0}
              max={60}
              value={form.redondeoMinutos}
              onChange={(e) => setForm({ ...form, redondeoMinutos: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">
              Tolerancia llegada tarde (minutos) <span className="text-slate-400">— 0 = sin margen</span>
            </label>
            <input
              type="number"
              min={0}
              max={120}
              value={form.toleranciaMinutos}
              onChange={(e) => setForm({ ...form, toleranciaMinutos: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={crear.isPending}
            className="w-full bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50"
          >
            {crear.isPending ? "Guardando..." : "Agregar jornada"}
          </button>
        </form>
      </div>

      <div className="card p-5 col-span-2">
        <h2 className="font-medium text-slate-700 mb-3">Jornadas definidas</h2>
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        {isLoading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Horario</th>
                <th className="pb-2">Redondeo</th>
                <th className="pb-2">Tolerancia</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {jornadas?.map((j) => (
                <tr key={j.id} className="border-b last:border-0">
                  <td className="py-2">{j.nombre}</td>
                  <td className="py-2">
                    {j.horaInicio} - {j.horaFin}
                  </td>
                  <td className="py-2">{j.redondeoMinutos > 0 ? `${j.redondeoMinutos} min` : "-"}</td>
                  <td className="py-2">{j.toleranciaMinutos > 0 ? `${j.toleranciaMinutos} min` : "-"}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => eliminar.mutate(j.id)} className="text-red-500 text-xs">
                      eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {jornadas?.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-400">
                    Todavía no hay jornadas definidas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function FeriadosPanel() {
  const queryClient = useQueryClient();
  const { data: feriados } = useQuery({
    queryKey: ["feriados"],
    queryFn: async () => (await api.get("/configuracion/feriados")).data as Feriado[],
  });

  const [nuevoFeriado, setNuevoFeriado] = useState({ fecha: "", nombre: "" });
  const crearFeriado = useMutation({
    mutationFn: async () => api.post("/configuracion/feriados", nuevoFeriado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feriados"] });
      setNuevoFeriado({ fecha: "", nombre: "" });
    },
  });
  const borrarFeriado = useMutation({
    mutationFn: async (id: string) => api.delete(`/configuracion/feriados/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feriados"] }),
  });

  return (
    <div className="card p-5 max-w-xl">
      <h2 className="font-medium text-slate-700 mb-3">Feriados</h2>
      <ul className="text-sm mb-3 space-y-1 max-h-64 overflow-auto">
        {feriados?.map((f) => (
          <li key={f.id} className="flex justify-between items-center text-slate-600">
            <span>
              {new Date(f.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })} - {f.nombre}
            </span>
            <button onClick={() => borrarFeriado.mutate(f.id)} className="text-red-500 text-xs">
              eliminar
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          crearFeriado.mutate();
        }}
        className="flex gap-2"
      >
        <input
          type="date"
          required
          value={nuevoFeriado.fecha}
          onChange={(e) => setNuevoFeriado({ ...nuevoFeriado, fecha: e.target.value })}
          className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
        />
        <input
          required
          placeholder="Nombre"
          value={nuevoFeriado.nombre}
          onChange={(e) => setNuevoFeriado({ ...nuevoFeriado, nombre: e.target.value })}
          className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
        />
        <button type="submit" className="bg-primary text-white text-sm px-3 py-1.5 rounded-md">
          Agregar
        </button>
      </form>
    </div>
  );
}
