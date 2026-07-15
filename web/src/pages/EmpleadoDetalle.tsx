import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";
import { TIPOS_AUSENCIA, labelTipoAusencia } from "../lib/tiposAusencia.js";
import FichadaEditModal from "../components/FichadaEditModal.js";
import { invalidarAsistenciaRelacionada } from "../lib/invalidarAsistencia.js";

interface Empleado {
  id: string;
  legajo: string;
  nombre: string;
  apellido: string;
  sindicato: string | null;
  fechaIngreso: string;
  valorHoraNormal: number;
  horasTeoricasDiarias: number;
  activo: boolean;
  empresaId: string | null;
  sectorId: string | null;
  empresa: { nombre: string } | null;
  sector: { nombre: string } | null;
}

interface Empresa {
  id: string;
  nombre: string;
}

interface Sector {
  id: string;
  nombre: string;
}

interface Fichada {
  id: string;
  horaEntrada: string;
  horaSalida: string | null;
}

interface DiaResumen {
  fecha: string;
  tipoDia: string;
  horasNormales: number;
  horasExtra50: number;
  horasExtra100: number;
  ausente: boolean;
  justificada: boolean | null;
  tipoAusencia: string | null;
  extrasValidadas: boolean;
  horasManual: boolean;
  tarde: boolean;
  retiroAnticipado: boolean;
  fichadas: Fichada[];
}

const tabs = ["fichadas", "ausencias", "vacaciones", "francos"] as const;
type Tab = (typeof tabs)[number];

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
function formatHora(iso: string) {
  return new Date(iso).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function EmpleadoDetalle() {
  const { id } = useParams<{ id: string }>();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>("fichadas");
  const [editando, setEditando] = useState(false);
  const [errorEliminar, setErrorEliminar] = useState<string | null>(null);
  const [desde, setDesde] = useState(firstOfMonth());
  const [hasta, setHasta] = useState(today());

  const { data: empleado } = useQuery({
    queryKey: ["empleado", id],
    queryFn: async () => (await api.get(`/empleados/${id}`)).data as Empleado,
  });
  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => (await api.get("/empresas")).data as Empresa[],
    enabled: isAdmin,
  });
  const { data: sectores } = useQuery({
    queryKey: ["sectores"],
    queryFn: async () => (await api.get("/sectores")).data as Sector[],
    enabled: isAdmin,
  });
  const { data: dias, isLoading: cargandoDias } = useQuery({
    queryKey: ["asistencia-empleado", id, desde, hasta],
    queryFn: async () => (await api.get(`/asistencia/empleado/${id}?desde=${desde}&hasta=${hasta}`)).data as DiaResumen[],
    enabled: tab === "fichadas" || tab === "ausencias",
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

  const validar = useMutation({
    mutationFn: async (fecha: string) => api.put("/asistencia/validar", { employeeId: id, fecha }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["asistencia-empleado", id] }),
  });

  const [diaEnEdicion, setDiaEnEdicion] = useState<DiaResumen | null>(null);

  // --- edición ---
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    sindicato: "",
    fechaIngreso: "",
    valorHoraNormal: "",
    horasTeoricasDiarias: "",
    empresaId: "",
    sectorId: "",
  });
  useEffect(() => {
    if (empleado) {
      setForm({
        nombre: empleado.nombre,
        apellido: empleado.apellido,
        sindicato: empleado.sindicato ?? "",
        fechaIngreso: empleado.fechaIngreso.slice(0, 10),
        valorHoraNormal: String(empleado.valorHoraNormal),
        horasTeoricasDiarias: String(empleado.horasTeoricasDiarias),
        empresaId: empleado.empresaId ?? "",
        sectorId: empleado.sectorId ?? "",
      });
    }
  }, [empleado]);

  const guardarEdicion = useMutation({
    mutationFn: async () =>
      api.put(`/empleados/${id}`, {
        ...form,
        sindicato: form.sindicato || null,
        valorHoraNormal: Number(form.valorHoraNormal),
        horasTeoricasDiarias: Number(form.horasTeoricasDiarias),
        sectorId: form.sectorId || null,
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

  // --- nueva ausencia manual / edición de una ausencia existente ---
  const [nuevaAusencia, setNuevaAusencia] = useState({
    fechaDesde: "",
    fechaHasta: "",
    tipo: "PERMISO_PERSONAL",
    justificada: true,
    observaciones: "",
  });
  const [editandoAusenciaId, setEditandoAusenciaId] = useState<string | null>(null);
  function cancelarEdicionAusencia() {
    setEditandoAusenciaId(null);
    setNuevaAusencia({ fechaDesde: "", fechaHasta: "", tipo: "PERMISO_PERSONAL", justificada: true, observaciones: "" });
  }
  const crearAusencia = useMutation({
    mutationFn: async () => {
      const data = {
        employeeId: id,
        fechaDesde: nuevaAusencia.fechaDesde,
        fechaHasta: nuevaAusencia.fechaHasta || nuevaAusencia.fechaDesde,
        tipo: nuevaAusencia.justificada ? nuevaAusencia.tipo : "INJUSTIFICADA",
        justificada: nuevaAusencia.justificada,
        observaciones: nuevaAusencia.observaciones || undefined,
      };
      return editandoAusenciaId ? api.put(`/ausencias/${editandoAusenciaId}`, data) : api.post("/ausencias", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ausencias", id] });
      invalidarAsistenciaRelacionada(queryClient);
      cancelarEdicionAusencia();
    },
  });
  const eliminarAusencia = useMutation({
    mutationFn: async (ausenciaId: string) => api.delete(`/ausencias/${ausenciaId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ausencias", id] });
      invalidarAsistenciaRelacionada(queryClient);
    },
  });

  // --- clasificar un día detectado como falta (sin fichada) ---
  const [faltaEnEdicion, setFaltaEnEdicion] = useState<string | null>(null); // fecha YYYY-MM-DD
  const [claseFalta, setClaseFalta] = useState({ tipo: "PERMISO_PERSONAL", justificada: true, observaciones: "" });
  const clasificarFalta = useMutation({
    mutationFn: async () =>
      api.post("/ausencias", {
        employeeId: id,
        fechaDesde: faltaEnEdicion,
        fechaHasta: faltaEnEdicion,
        tipo: claseFalta.justificada ? claseFalta.tipo : "INJUSTIFICADA",
        justificada: claseFalta.justificada,
        observaciones: claseFalta.observaciones || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ausencias", id] });
      invalidarAsistenciaRelacionada(queryClient);
      setFaltaEnEdicion(null);
      setClaseFalta({ tipo: "PERMISO_PERSONAL", justificada: true, observaciones: "" });
    },
  });

  // --- cargar / editar / eliminar un período de vacaciones ---
  const [nuevaVacacion, setNuevaVacacion] = useState({ fechaDesde: "", fechaHasta: "", diasTomados: "" });
  const [editandoVacacionId, setEditandoVacacionId] = useState<string | null>(null);
  function cancelarEdicionVacacion() {
    setEditandoVacacionId(null);
    setNuevaVacacion({ fechaDesde: "", fechaHasta: "", diasTomados: "" });
  }
  const guardarVacacion = useMutation({
    mutationFn: async () => {
      const data = {
        employeeId: id,
        anioCorrespondiente: vacaciones?.anio ?? new Date().getFullYear(),
        fechaDesde: nuevaVacacion.fechaDesde,
        fechaHasta: nuevaVacacion.fechaHasta,
        diasTomados: Number(nuevaVacacion.diasTomados),
      };
      return editandoVacacionId ? api.put(`/vacaciones/${editandoVacacionId}`, data) : api.post("/vacaciones", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacaciones-balance", id] });
      invalidarAsistenciaRelacionada(queryClient);
      cancelarEdicionVacacion();
    },
  });
  const eliminarVacacion = useMutation({
    mutationFn: async (vacacionId: string) => api.delete(`/vacaciones/${vacacionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vacaciones-balance", id] });
      invalidarAsistenciaRelacionada(queryClient);
    },
  });

  if (!empleado) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div>
      <div className="flex items-start justify-between mb-1">
        <h1 className="page-header">
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
        Legajo {empleado.legajo} · {empleado.empresa?.nombre ?? "Sin empresa"} · {empleado.sector?.nombre ?? "Sin sector"}
        {empleado.sindicato ? ` · ${empleado.sindicato}` : ""} · $
        {empleado.valorHoraNormal.toLocaleString("es-AR")}/hora · {empleado.horasTeoricasDiarias}hs teóricas/día
      </p>
      {errorEliminar && <p className="text-sm text-red-600 mb-4">{errorEliminar}</p>}

      {editando && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            guardarEdicion.mutate();
          }}
          className="card p-5 mb-6 grid grid-cols-3 gap-4"
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
            <label className="block text-sm text-slate-600 mb-1">Horas teóricas diarias</label>
            <input
              type="number"
              step="0.5"
              required
              value={form.horasTeoricasDiarias}
              onChange={(e) => setForm({ ...form, horasTeoricasDiarias: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Empresa</label>
            <select
              required
              value={form.empresaId}
              onChange={(e) => setForm({ ...form, empresaId: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Seleccionar...</option>
              {empresas?.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Sector</label>
            <select
              value={form.sectorId}
              onChange={(e) => setForm({ ...form, sectorId: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {sectores?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3">
            <button type="submit" className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark">
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
              tab === t ? "bg-primary text-white" : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="card p-5">
        {tab === "fichadas" && (
          <div>
            <div className="flex gap-3 items-end mb-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Desde</label>
                <input
                  type="date"
                  value={desde}
                  onChange={(e) => setDesde(e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Hasta</label>
                <input
                  type="date"
                  value={hasta}
                  onChange={(e) => setHasta(e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            {cargandoDias ? (
              <p className="text-slate-500 text-sm">Cargando...</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="pb-2">Fecha</th>
                    <th className="pb-2">Marcaciones</th>
                    <th className="pb-2">Hs. trabajadas</th>
                    <th className="pb-2">Extra 50%</th>
                    <th className="pb-2">Extra 100%</th>
                    <th className="pb-2">Día</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {dias
                    ?.filter((d) => d.fichadas.length > 0 || d.horasNormales + d.horasExtra50 + d.horasExtra100 > 0)
                    .map((d) => {
                      const horasTrabajadas = d.horasNormales + d.horasExtra50 + d.horasExtra100;
                      const tieneExtras = d.horasExtra50 > 0 || d.horasExtra100 > 0;
                      const esDomingoOFeriado = d.tipoDia === "DOMINGO" || d.tipoDia === "FERIADO";
                      return (
                        <tr key={d.fecha} className="border-b last:border-0">
                          <td className="py-2">{new Date(d.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                          <td className="py-2">
                            {d.fichadas.map((f, i) => (
                              <span key={f.id} className="mr-2 whitespace-nowrap">
                                {formatHora(f.horaEntrada)}-{f.horaSalida ? formatHora(f.horaSalida) : "?"}
                                {i < d.fichadas.length - 1 ? "," : ""}
                              </span>
                            ))}
                            {d.tarde && (
                              <span className="ml-1 text-[10px] font-medium text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                Tardanza
                              </span>
                            )}
                            {d.retiroAnticipado && (
                              <span className="ml-1 text-[10px] font-medium text-orange-700 bg-orange-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                                Retiro anticipado
                              </span>
                            )}
                          </td>
                          <td className="py-2">
                            {horasTrabajadas.toFixed(1)}
                            {d.horasManual && <span className="ml-1 text-[10px] text-accent-dark align-middle">(manual)</span>}
                          </td>
                          <td className="py-2">{d.horasExtra50 > 0 ? d.horasExtra50.toFixed(1) : "-"}</td>
                          <td className="py-2">{d.horasExtra100 > 0 ? d.horasExtra100.toFixed(1) : "-"}</td>
                          <td className="py-2">
                            {esDomingoOFeriado ? (
                              <span className="text-accent-dark">
                                {d.tipoDia === "DOMINGO" ? "Domingo" : "Feriado"} ({horasTrabajadas.toFixed(1)}hs)
                              </span>
                            ) : (
                              d.tipoDia
                            )}
                          </td>
                          <td className="py-2 text-right whitespace-nowrap">
                            <button
                              onClick={() => setDiaEnEdicion(d)}
                              className="text-slate-500 hover:text-primary text-xs underline mr-3"
                            >
                              Corregir
                            </button>
                            {tieneExtras &&
                              (d.extrasValidadas ? (
                                <span className="text-primary-dark text-xs">✓ Validado</span>
                              ) : (
                                <button
                                  onClick={() => validar.mutate(d.fecha)}
                                  disabled={validar.isPending}
                                  className="bg-primary text-white text-xs px-3 py-1.5 rounded-md hover:bg-primary-dark disabled:opacity-50"
                                >
                                  Validar
                                </button>
                              ))}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {tab === "ausencias" && (
          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-2">
              {editandoAusenciaId ? "Editar ausencia / incidencia" : "Registrar ausencia / incidencia"}
            </h3>
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
                    nuevaAusencia.justificada ? "bg-primary text-white" : "bg-slate-100 text-slate-600"
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
              <div className="col-span-2 flex gap-2">
                <button
                  type="submit"
                  disabled={
                    (nuevaAusencia.justificada && nuevaAusencia.tipo === "OTRA" && !nuevaAusencia.observaciones.trim()) ||
                    crearAusencia.isPending
                  }
                  className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50"
                >
                  {crearAusencia.isPending ? "Guardando..." : editandoAusenciaId ? "Guardar cambios" : "Registrar"}
                </button>
                {editandoAusenciaId && (
                  <button type="button" onClick={cancelarEdicionAusencia} className="text-sm text-slate-600 px-4 py-2">
                    Cancelar edición
                  </button>
                )}
              </div>
            </form>

            <h3 className="text-sm font-medium text-slate-700 mb-1">Días sin fichada</h3>
            <p className="text-xs text-slate-500 mb-3">
              Días detectados como falta (sin marcación) entre el{" "}
              {new Date(`${desde}T00:00:00`).toLocaleDateString("es-AR", { timeZone: "UTC" })} y el{" "}
              {new Date(`${hasta}T00:00:00`).toLocaleDateString("es-AR", { timeZone: "UTC" })} (mismo rango que la pestaña
              Fichadas), estén o no clasificados todavía.
            </p>
            <table className="w-full text-sm mb-6">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2">Fecha</th>
                  <th className="pb-2">Estado</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {dias?.filter((d) => d.ausente).length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-3 text-center text-slate-400">
                      Sin faltas en el período.
                    </td>
                  </tr>
                )}
                {dias
                  ?.filter((d) => d.ausente)
                  .map((d) => (
                    <tr key={d.fecha} className="border-b last:border-0">
                      <td className="py-2">{new Date(d.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                      <td className="py-2">
                        {d.justificada === null ? (
                          <span className="text-amber-600">Sin clasificar</span>
                        ) : d.justificada ? (
                          <span className="text-primary-dark">Justificada — {labelTipoAusencia(d.tipoAusencia ?? "OTRA")}</span>
                        ) : (
                          <span className="text-red-600">Injustificada</span>
                        )}
                      </td>
                      <td className="py-2 text-right">
                        {d.justificada === null && (
                          <button
                            onClick={() => {
                              setFaltaEnEdicion(d.fecha.slice(0, 10));
                              setClaseFalta({ tipo: "PERMISO_PERSONAL", justificada: true, observaciones: "" });
                            }}
                            className="text-slate-700 underline text-xs"
                          >
                            Clasificar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>

            <h3 className="text-sm font-medium text-slate-700 mb-2">Ausencias registradas</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2">Desde</th>
                  <th className="pb-2">Hasta</th>
                  <th className="pb-2">Tipo</th>
                  <th className="pb-2">Justificada</th>
                  <th className="pb-2">Observaciones</th>
                  <th className="pb-2"></th>
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
                    <td className="py-2 text-right">
                      <button
                        onClick={() => {
                          setEditandoAusenciaId(a.id);
                          setNuevaAusencia({
                            fechaDesde: a.fechaDesde.slice(0, 10),
                            fechaHasta: a.fechaHasta.slice(0, 10),
                            tipo: a.tipo,
                            justificada: a.justificada,
                            observaciones: a.observaciones ?? "",
                          });
                        }}
                        className="text-slate-700 underline text-xs"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `¿Eliminar esta ausencia (${new Date(a.fechaDesde).toLocaleDateString("es-AR", { timeZone: "UTC" })} - ${new Date(a.fechaHasta).toLocaleDateString("es-AR", { timeZone: "UTC" })})? Esta acción no se puede deshacer.`
                            )
                          ) {
                            eliminarAusencia.mutate(a.id);
                          }
                        }}
                        className="text-red-600 underline text-xs ml-3"
                      >
                        Eliminar
                      </button>
                    </td>
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
                <div className="text-2xl font-semibold text-primary">{vacaciones.restantes}</div>
              </div>
            </div>

            <h3 className="text-sm font-medium text-slate-700 mb-2">
              {editandoVacacionId ? "Editar período de vacaciones" : "Cargar período tomado"}
            </h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                guardarVacacion.mutate();
              }}
              className="flex gap-3 items-end mb-6"
            >
              <div>
                <label className="block text-xs text-slate-500 mb-1">Desde</label>
                <input
                  type="date"
                  required
                  value={nuevaVacacion.fechaDesde}
                  onChange={(e) => setNuevaVacacion({ ...nuevaVacacion, fechaDesde: e.target.value })}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Hasta</label>
                <input
                  type="date"
                  required
                  value={nuevaVacacion.fechaHasta}
                  onChange={(e) => setNuevaVacacion({ ...nuevaVacacion, fechaHasta: e.target.value })}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Días</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={nuevaVacacion.diasTomados}
                  onChange={(e) => setNuevaVacacion({ ...nuevaVacacion, diasTomados: e.target.value })}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm w-20"
                />
              </div>
              <button
                type="submit"
                disabled={guardarVacacion.isPending}
                className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50"
              >
                {guardarVacacion.isPending ? "Guardando..." : editandoVacacionId ? "Guardar cambios" : "Guardar"}
              </button>
              {editandoVacacionId && (
                <button type="button" onClick={cancelarEdicionVacacion} className="text-sm text-slate-600 px-2 py-2">
                  Cancelar edición
                </button>
              )}
            </form>

            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2">Desde</th>
                  <th className="pb-2">Hasta</th>
                  <th className="pb-2">Días</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {vacaciones.periodos.map((p: any) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2">{new Date(p.fechaDesde).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                    <td className="py-2">{new Date(p.fechaHasta).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                    <td className="py-2">{p.diasTomados}</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={() => {
                          setEditandoVacacionId(p.id);
                          setNuevaVacacion({
                            fechaDesde: p.fechaDesde.slice(0, 10),
                            fechaHasta: p.fechaHasta.slice(0, 10),
                            diasTomados: String(p.diasTomados),
                          });
                        }}
                        className="text-slate-700 underline text-xs"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `¿Eliminar este período de vacaciones (${new Date(p.fechaDesde).toLocaleDateString("es-AR", { timeZone: "UTC" })} - ${new Date(p.fechaHasta).toLocaleDateString("es-AR", { timeZone: "UTC" })})? Esta acción no se puede deshacer.`
                            )
                          ) {
                            eliminarVacacion.mutate(p.id);
                          }
                        }}
                        className="text-red-600 underline text-xs ml-3"
                      >
                        Eliminar
                      </button>
                    </td>
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

      {diaEnEdicion && empleado && (
        <FichadaEditModal
          employeeId={empleado.id}
          empleadoNombre={`${empleado.apellido}, ${empleado.nombre}`}
          fecha={diaEnEdicion.fecha.slice(0, 10)}
          fichadas={diaEnEdicion.fichadas}
          horasNormales={diaEnEdicion.horasNormales}
          horasExtra50={diaEnEdicion.horasExtra50}
          horasExtra100={diaEnEdicion.horasExtra100}
          horasManual={diaEnEdicion.horasManual}
          onClose={() => setDiaEnEdicion(null)}
          onSaved={() => invalidarAsistenciaRelacionada(queryClient)}
        />
      )}

      {faltaEnEdicion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setFaltaEnEdicion(null)}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium text-slate-800 mb-1">Clasificar falta</h3>
            <p className="text-sm text-slate-500 mb-4">
              {empleado.apellido}, {empleado.nombre} ·{" "}
              {new Date(`${faltaEnEdicion}T00:00:00`).toLocaleDateString("es-AR", { timeZone: "UTC" })}
            </p>
            <label className="block text-xs text-slate-500 mb-1">¿La falta está justificada?</label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setClaseFalta({ ...claseFalta, justificada: true })}
                className={`flex-1 py-1.5 rounded-md text-sm ${
                  claseFalta.justificada ? "bg-primary text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                Justificada
              </button>
              <button
                onClick={() => setClaseFalta({ ...claseFalta, justificada: false })}
                className={`flex-1 py-1.5 rounded-md text-sm ${
                  !claseFalta.justificada ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"
                }`}
              >
                Injustificada
              </button>
            </div>
            {claseFalta.justificada && (
              <div className="mb-3">
                <label className="block text-xs text-slate-500 mb-1">Motivo</label>
                <select
                  value={claseFalta.tipo}
                  onChange={(e) => setClaseFalta({ ...claseFalta, tipo: e.target.value })}
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
            <div className="mb-4">
              <label className="block text-xs text-slate-500 mb-1">
                Observaciones {claseFalta.justificada && claseFalta.tipo === "OTRA" ? "(obligatorio: aclarar el motivo)" : ""}
              </label>
              <textarea
                value={claseFalta.observaciones}
                onChange={(e) => setClaseFalta({ ...claseFalta, observaciones: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setFaltaEnEdicion(null)} className="px-4 py-2 text-sm text-slate-600">
                Cancelar
              </button>
              <button
                onClick={() => clasificarFalta.mutate()}
                disabled={
                  (claseFalta.justificada && claseFalta.tipo === "OTRA" && !claseFalta.observaciones.trim()) ||
                  clasificarFalta.isPending
                }
                className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50"
              >
                {clasificarFalta.isPending ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
