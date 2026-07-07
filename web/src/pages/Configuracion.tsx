import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";

interface Config {
  horasNormalesPorDia: number;
  horaCorteSabado: string;
  multiplicadorExtra50: number;
  multiplicadorExtra100: number;
  horasFrancoCompensatorio: number;
  feriadoComoDomingo: boolean;
  escalaVacaciones: { hastaAnios: number; dias: number }[];
}

export default function Configuracion() {
  const queryClient = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["configuracion"],
    queryFn: async () => (await api.get("/configuracion")).data as Config,
  });
  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => (await api.get("/empresas")).data as { id: string; nombre: string }[],
  });
  const { data: sectores } = useQuery({
    queryKey: ["sectores"],
    queryFn: async () =>
      (await api.get("/sectores")).data as {
        id: string;
        nombre: string;
        empresa: { nombre: string } | null;
        trabajaSabados: boolean;
      }[],
  });
  const { data: feriados } = useQuery({
    queryKey: ["feriados"],
    queryFn: async () => (await api.get("/configuracion/feriados")).data as { id: string; fecha: string; nombre: string }[],
  });

  const [local, setLocal] = useState<Config | null>(null);
  useEffect(() => {
    if (config) setLocal(config);
  }, [config]);

  const guardar = useMutation({
    mutationFn: async () => api.put("/configuracion", local),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["configuracion"] }),
  });

  const [nuevaEmpresa, setNuevaEmpresa] = useState("");
  const crearEmpresa = useMutation({
    mutationFn: async () => api.post("/empresas", { nombre: nuevaEmpresa }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empresas"] });
      setNuevaEmpresa("");
    },
  });

  const [nuevoSector, setNuevoSector] = useState({ nombre: "", empresaId: "" });
  const crearSector = useMutation({
    mutationFn: async () => api.post("/sectores", nuevoSector),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sectores"] });
      setNuevoSector({ nombre: "", empresaId: "" });
    },
  });

  const actualizarSector = useMutation({
    mutationFn: async ({ id, trabajaSabados }: { id: string; trabajaSabados: boolean }) =>
      api.put(`/sectores/${id}`, { trabajaSabados }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sectores"] }),
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

  if (!local) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Configuración</h1>

      <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
        <h2 className="font-medium text-slate-700 mb-3">Reglas de cálculo de horas</h2>
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Horas normales por día</label>
            <input
              type="number"
              value={local.horasNormalesPorDia}
              onChange={(e) => setLocal({ ...local, horasNormalesPorDia: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Corte sábado (hora)</label>
            <input
              type="time"
              value={local.horaCorteSabado}
              onChange={(e) => setLocal({ ...local, horaCorteSabado: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Horas de franco compensatorio</label>
            <input
              type="number"
              value={local.horasFrancoCompensatorio}
              onChange={(e) => setLocal({ ...local, horasFrancoCompensatorio: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Multiplicador extra 50% (ej. 1.5)</label>
            <input
              type="number"
              step="0.01"
              value={local.multiplicadorExtra50}
              onChange={(e) => setLocal({ ...local, multiplicadorExtra50: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Multiplicador extra 100% (ej. 2.0)</label>
            <input
              type="number"
              step="0.01"
              value={local.multiplicadorExtra100}
              onChange={(e) => setLocal({ ...local, multiplicadorExtra100: Number(e.target.value) })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={local.feriadoComoDomingo}
                onChange={(e) => setLocal({ ...local, feriadoComoDomingo: e.target.checked })}
              />
              Tratar feriados como domingo
            </label>
          </div>
        </div>

        <h3 className="text-sm font-medium text-slate-700 mb-2">Escala de vacaciones por antigüedad</h3>
        <div className="space-y-2 mb-3">
          {local.escalaVacaciones.map((tramo, i) => (
            <div key={i} className="flex gap-3 items-center">
              <span className="text-sm text-slate-500">Hasta</span>
              <input
                type="number"
                value={tramo.hastaAnios}
                onChange={(e) => {
                  const escala = [...local.escalaVacaciones];
                  escala[i] = { ...tramo, hastaAnios: Number(e.target.value) };
                  setLocal({ ...local, escalaVacaciones: escala });
                }}
                className="w-20 border border-slate-300 rounded-md px-2 py-1 text-sm"
              />
              <span className="text-sm text-slate-500">años →</span>
              <input
                type="number"
                value={tramo.dias}
                onChange={(e) => {
                  const escala = [...local.escalaVacaciones];
                  escala[i] = { ...tramo, dias: Number(e.target.value) };
                  setLocal({ ...local, escalaVacaciones: escala });
                }}
                className="w-20 border border-slate-300 rounded-md px-2 py-1 text-sm"
              />
              <span className="text-sm text-slate-500">días</span>
            </div>
          ))}
        </div>

        <button onClick={() => guardar.mutate()} className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark">
          {guardar.isPending ? "Guardando..." : "Guardar configuración"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="font-medium text-slate-700 mb-3">Empresas</h2>
          <ul className="text-sm mb-3 space-y-1">
            {empresas?.map((emp) => (
              <li key={emp.id} className="text-slate-600">
                {emp.nombre}
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crearEmpresa.mutate();
            }}
            className="flex gap-2"
          >
            <input
              value={nuevaEmpresa}
              onChange={(e) => setNuevaEmpresa(e.target.value)}
              placeholder="Nombre de la empresa"
              className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
            <button type="submit" className="bg-primary text-white text-sm px-3 py-1.5 rounded-md">
              Agregar
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="font-medium text-slate-700 mb-3">Sectores</h2>
          <ul className="text-sm mb-3 space-y-1.5">
            {sectores?.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-slate-600">
                <span>
                  {s.nombre} {s.empresa ? `(${s.empresa.nombre})` : ""}
                </span>
                <label className="flex items-center gap-1.5 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={s.trabajaSabados}
                    onChange={(e) => actualizarSector.mutate({ id: s.id, trabajaSabados: e.target.checked })}
                  />
                  Trabaja sábados
                </label>
              </li>
            ))}
          </ul>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crearSector.mutate();
            }}
            className="space-y-2"
          >
            <input
              value={nuevoSector.nombre}
              onChange={(e) => setNuevoSector({ ...nuevoSector, nombre: e.target.value })}
              placeholder="Nombre del sector"
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
            <select
              value={nuevoSector.empresaId}
              onChange={(e) => setNuevoSector({ ...nuevoSector, empresaId: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            >
              <option value="">Sin empresa</option>
              {empresas?.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombre}
                </option>
              ))}
            </select>
            <button type="submit" className="bg-primary text-white text-sm px-3 py-1.5 rounded-md w-full">
              Agregar
            </button>
          </form>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5">
          <h2 className="font-medium text-slate-700 mb-3">Feriados</h2>
          <ul className="text-sm mb-3 space-y-1 max-h-40 overflow-auto">
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
      </div>
    </div>
  );
}
