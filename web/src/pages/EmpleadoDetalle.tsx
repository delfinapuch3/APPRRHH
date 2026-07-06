import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";
import { TIPOS_AUSENCIA, labelTipoAusencia } from "../lib/tiposAusencia.js";

interface Empleado {
  id: string;
  legajo: string;
  nombre: string;
  apellido: string;
  sindicato: string | null;
  fechaIngreso: string;
  valorHoraNormal: number;
  activo: boolean;
  obraId: string | null;
  obra: { nombre: string } | null;
}

interface Obra {
  id: string;
  nombre: string;
}

const tabs = ["fichadas", "ausencias", "vacaciones", "francos"] as const;
type Tab = (typeof tabs)[number];

export default function EmpleadoDetalle() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("fichadas");
  const [editando, setEditando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);

  const { data: empleado } = useQuery({
    queryKey: ["empleado", id],
    queryFn: async () => (await api.get(`/empleados/${id}`)).data as Empleado,
  });
  const { data: obras } = useQuery({
    queryKey: ["obras"],
    queryFn: async () => (await api.get("/obras")).data as Obra[],
    enabled: isAdmin,
  });

  const { data: fichadas } = useQuery({
    queryKey: ["fichadas", id],
    queryFn: async () => (await api.get(`/fichadas?employeeId=${id}`)).data as any[],
    enabled: tab === "fichadas",
  });
  const { data: ausencias } = useQuery({
    queryKey: ["ausencias", id],
    queryFn: async () => (await api.get(`/ausencias?employeeId=${id}`)).data as any[],
    enabled: tab === "ausencias",
  });
  const { data: vacaciones } = useQuery({
    queryKey: ["vacaciones-balance", id],
    queryFn: async () => (await api.get(`/vacaciones/${id}/balance`)).data,
    enabled: tab === "vacaciones",
  });
  const { data: francos } = useQuery({
    queryKey: ["francos", id],
    queryFn: async () => (await api.get(`/francos?employeeId=${id}`)).data as any[],
    enabled: tab === "francos",
  });

  // --- edición ---
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    sindicato: "",
    fechaIngreso: "",
    valorHoraNormal: "",
    obraId: "",
  });
  useEffect(() => {
    if (empleado) {
      setForm({
        nombre: empleado.nombre,
        apellido: empleado.apellido,
        sindicato: empleado.sindicato ?? "",
        fechaIngreso: empleado.fechaIngreso.slice(0, 10),
        valorHoraNormal: String(empleado.valorHoraNormal),
        obraId: empleado.obraId ?? "",
      });
    }
  }, [empleado]);

  const guardarEdicion = useMutation({
    mutationFn: async () =>
      api.put(`/empleados/${id}`, {
        ...form,
        sindicato: form.sindicato || null,
        valorHoraNormal: Number(form.valorHoraNormal),
        obraId: form.obraId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleado", id] });
      queryClient.invalidateQueries({ queryKey: ["empleados"] });
      setEditando(false);
    },
  });

  const toggleActivo = useMutation({
    mutationFn: async () => api.put(`/empleados/${id}`, { activo: !empleado?.activo }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleado", id] });
      queryClient.invalidateQueries({ queryKey: ["empleados"] });
    },
  });

  const eliminar = useMutation({
    mutationFn: async () => api.delete(`/empleados/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados"] });
      navigate("/empleados");
    },
    onError: (err: any) => {
      setErrorEliminar(err?.response?.data?.error ?? "No se pudo eliminar el empleado");
    },
  });

  // --- nueva ausencia manual ---
  const [nuevaAusencia, setNuevaAusencia] = useState({
    fechaDesde: "",
    fechaHasta: "",
    tipo: "PERMISO_PERSONAL",
    justificada: true,
    observaciones: "",
  });
  const crearAusencia = useMutation({
    mutationFn: async () =>
      api.post("/ausencias", {
        employeeId: id,
        fechaDesde: nuevaAusencia.fechaDesde,
        fechaHasta: nuevaAusencia.fechaHasta || nuevaAusencia.fechaDesde,
        tipo: nuevaAusencia.justificada ? nuevaAusencia.tipo : "INJUSTIFICADA",
        justificada: nuevaAusencia.justificada,
        observaciones: nuevaAusencia.observaciones || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ausencias", id] });
      setNuevaAusencia({ fechaDesde: "", fechaHasta: "", tipo: "PERMISO_PERSONAL", justificada: true, observaciones: "" });
    },
  });

  if (!empleado) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="text-2xl font-semibold text-slate-800">
          {empleado.apellido}, {empleado.nombre}
          {!empleado.activo && <span className="ml-2 text-sm font-normal text-red-600">(inactivo)</span>}
        </h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => setEditando((v) => !v)}
              className="bg-white border border-slate-300 text-slate-700 text-sm px-3 py-1.5 rounded-md hover:bg-slate-50"
            >
              {editando ? "Cancelar" : "Editar"}
            </button>
            <button
              onClick={() => toggleActivo.mutate()}
              className="bg-white border border-slate-300 text-slate-700 text-sm px-3 py-1.5 rounded-md hover:bg-slate-50"
            >
              {empleado.activo ? "Dar de baja" : "Reactivar"}
            </button>
            <button
              onClick={() => {
                setErrorEliminar(null);
                if (confirm(`¿Eliminar definitivamente a ${empleado.apellido}, ${empleado.nombre}? Esta acción no se puede deshacer.`)) {
                  eliminar.mutate();
                }
              }}
              className="bg-white border border-red-300 text-red-600 text-sm px-3 py-1.5 rounded-md hover:bg-red-50"
            >
              Eliminar
            </button>
          </div>
        )}
      </div>
      <p className="text-slate-500 mb-4">
        Legajo {empleado.legajo} · {empleado.obra?.nombre ?? "Sin obra"}
        {empleado.sindicato ? ` · ${empleado.sindicato}` : ""} · $
        {empleado.valorHoraNormal.toLocaleString("es-AR")}/hora
      </p>
      {errorEliminar && <p className="text-sm text-red-600 mb-4">{errorEliminar}</p>}

      {editando && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardarEdicion.mutate();
          }}
          className="bg-white rounded-lg shadow-sm p-5 mb-6 grid grid-cols-3 gap-4"
        >
          <div>
            <label className="block text-sm text-slate-600 mb-1">Nombre</label>
            <input
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Apellido</label>
            <input
              required
              value={form.apellido}
              onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Sindicato</label>
            <input
              value={form.sindicato}
              onChange={(e) => setForm({ ...form, sindicato: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Fecha de ingreso</label>
            <input
              type="date"
              required
              value={form.fechaIngreso}
              onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Valor hora normal ($)</label>
            <input
              type="number"
              step="0.01"
              required
              value={form.valorHoraNormal}
              onChange={(e) => setForm({ ...form, valorHoraNormal: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Obra</label>
            <select
              value={form.obraId}
              onChange={(e) => setForm({ ...form, obraId: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {obras?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3">
            <button type="submit" className="bg-slate-900 text-white text-sm px-4 py-2 rounded-md hover:bg-slate-800">
              Guardar cambios
            </button>
          </div>
        </form>
      )}

      <div className="flex gap-2 mb-4">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-md text-sm capitalize ${
              tab === t ? "bg-slate-900 text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-5">
        {tab === "fichadas" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Fecha</th>
                <th className="pb-2">Entrada</th>
                <th className="pb-2">Salida</th>
                <th className="pb-2">Origen</th>
              </tr>
            </thead>
            <tbody>
              {fichadas?.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="py-2">{new Date(f.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                  <td className="py-2">{new Date(f.horaEntrada).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="py-2">
                    {f.horaSalida ? new Date(f.horaSalida).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : "-"}
                  </td>
                  <td className="py-2">{f.origen}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "ausencias" && (
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">Registrar ausencia / incidencia</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                crearAusencia.mutate();
              }}
              className="grid grid-cols-2 gap-3 mb-6"
            >
              <div>
                <label className="block text-xs text-slate-500 mb-1">Desde</label>
                <input
                  type="date"
                  required
                  value={nuevaAusencia.fechaDesde}
                  onChange={(e) => setNuevaAusencia({ ...nuevaAusencia, fechaDesde: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Hasta</label>
                <input
                  type="date"
                  value={nuevaAusencia.fechaHasta}
                  onChange={(e) => setNuevaAusencia({ ...nuevaAusencia, fechaHasta: e.target.value })}
                  placeholder="igual que Desde"
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div className="col-span-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setNuevaAusencia({ ...nuevaAusencia, justificada: true })}
                  className={`flex-1 py-1.5 rounded-md text-sm ${
                    nuevaAusencia.justificada ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Justificada
                </button>
                <button
                  type="button"
                  onClick={() => setNuevaAusencia({ ...nuevaAusencia, justificada: false })}
                  className={`flex-1 py-1.5 rounded-md text-sm ${
                    !nuevaAusencia.justificada ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"
                  }`}
                >
                  Injustificada
                </button>
              </div>
              {nuevaAusencia.justificada && (
                <div className="col-span-2">
                  <label className="block text-xs text-slate-500 mb-1">Motivo</label>
                  <select
                    value={nuevaAusencia.tipo}
                    onChange={(e) => setNuevaAusencia({ ...nuevaAusencia, tipo: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  >
                    {TIPOS_AUSENCIA.filter(([v]) => v !== "INJUSTIFICADA").map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-span-2">
                <label className="block text-xs text-slate-500 mb-1">
                  Observaciones {nuevaAusencia.justificada && nuevaAusencia.tipo === "OTRA" ? "(obligatorio: aclarar el motivo)" : ""}
                </label>
                <textarea
                  value={nuevaAusencia.observaciones}
                  onChange={(e) => setNuevaAusencia({ ...nuevaAusencia, observaciones: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  rows={2}
                />
              </div>
              <div className="col-span-2">
                <button
                  type="submit"
                  disabled={
                    (nuevaAusencia.justificada && nuevaAusencia.tipo === "OTRA" && !nuevaAusencia.observaciones.trim()) ||
                    crearAusencia.isPending
                  }
                  className="bg-slate-900 text-white text-sm px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50"
                >
                  {crearAusencia.isPending ? "Guardando..." : "Registrar"}
                </button>
              </div>
            </form>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2">Desde</th>
                  <th className="pb-2">Hasta</th>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Justificada</th>
                  <th className="pb-2">Observaciones</th>
                </tr>
              </thead>
              <tbody>
                {ausencias?.map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2">{new Date(a.fechaDesde).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                    <td className="py-2">{new Date(a.fechaHasta).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                    <td className="py-2">{labelTipoAusencia(a.tipo)}</td>
                    <td className="py-2">{a.justificada ? "Sí" : "No"}</td>
                    <td className="py-2">{a.observaciones ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "vacaciones" && vacaciones && (
          <div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div>
                <div className="text-sm text-slate-500">Días correspondientes</div>
                <div className="text-2xl font-semibold">{vacaciones.correspondientes}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Días tomados</div>
                <div className="text-2xl font-semibold">{vacaciones.tomados}</div>
              </div>
              <div>
                <div className="text-sm text-slate-500">Días restantes</div>
                <div className="text-2xl font-semibold text-emerald-600">{vacaciones.restantes}</div>
              </div>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2">Desde</th>
                  <th className="pb-2">Hasta</th>
                  <th className="pb-2">Días</th>
                </tr>
              </thead>
              <tbody>
                {vacaciones.periodos.map((p: any) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2">{new Date(p.fechaDesde).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                    <td className="py-2">{new Date(p.fechaHasta).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                    <td className="py-2">{p.diasTomados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === "francos" && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Generado</th>
                <th className="pb-2">Horas</th>
                <th className="pb-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {francos?.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="py-2">{new Date(f.fechaGenerado).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                  <td className="py-2">{f.horas}</td>
                  <td className="py-2">{f.estado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
