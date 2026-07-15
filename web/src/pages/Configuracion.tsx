import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../api/client.js";

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
    queryFn: async () => (await api.get("/sectores")).data as { id: string; nombre: string; activo: boolean }[],
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

  const [nuevoSector, setNuevoSector] = useState({ nombre: "" });
  const [errorSector, setErrorSector] = useState<string | null>(null);
  const crearSector = useMutation({
    mutationFn: async () => api.post("/sectores", nuevoSector),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sectores"] });
      setNuevoSector({ nombre: "" });
      setErrorSector(null);
    },
    onError: (err) => setErrorSector(errorMessage(err, "No se pudo crear el sector")),
  });
  const toggleSector = useMutation({
    mutationFn: async ({ id, activo }: { id: string; activo: boolean }) => api.put(`/sectores/${id}`, { activo }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sectores"] }),
  });

  if (!local) return <p className="text-slate-500">Cargando...</p>;

  return (
    <div>
      <h1 className="page-header mb-6">Configuración</h1>

      <div className="card p-5 mb-6">
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

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
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

        <div className="card p-5">
          <h2 className="font-medium text-slate-700 mb-3">Sectores</h2>
          <p className="text-xs text-slate-400 mb-2">
            Un sector agrupa empleados de ambas empresas (ej. "Calidad" incluye a Calidad de Polcecal y de Polysan).
          </p>
          <ul className="text-sm mb-3 space-y-1">
            {sectores?.map((s) => (
              <li key={s.id} className={`flex items-center justify-between gap-2 ${s.activo ? "text-slate-600" : "text-slate-400"}`}>
                <span>
                  {s.nombre}
                  {!s.activo && <span className="ml-1 text-xs">· inactivo</span>}
                </span>
                <button
                  onClick={() => toggleSector.mutate({ id: s.id, activo: !s.activo })}
                  className="text-xs underline text-slate-500 hover:text-slate-700 whitespace-nowrap"
                >
                  {s.activo ? "Desactivar" : "Reactivar"}
                </button>
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
            {errorSector && <p className="text-xs text-red-600">{errorSector}</p>}
            <button type="submit" className="bg-primary text-white text-sm px-3 py-1.5 rounded-md w-full">
              Agregar
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
