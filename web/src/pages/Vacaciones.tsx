import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { invalidarAsistenciaRelacionada } from "../lib/invalidarAsistencia.js";

interface Empleado {
  id: string;
  legajo: string;
  nombre: string;
  apellido: string;
}

interface PeriodoHistorial {
  id: string;
  anioCorrespondiente: number;
  fechaDesde: string;
  fechaHasta: string;
  diasTomados: number;
  employee: { legajo: string; nombre: string; apellido: string };
}

export default function Vacaciones() {
  const queryClient = useQueryClient();
  const [vista, setVista] = useState<"empleado" | "historial">("empleado");
  const { data: empleados } = useQuery({
    queryKey: ["empleados"],
    queryFn: async () => (await api.get("/empleados")).data as Empleado[],
  });
  const [employeeId, setEmployeeId] = useState("");
  const [anio, setAnio] = useState(new Date().getFullYear());

  const { data: historial, isLoading: cargandoHistorial } = useQuery({
    queryKey: ["vacaciones-historial"],
    queryFn: async () => (await api.get("/vacaciones")).data as PeriodoHistorial[],
    enabled: vista === "historial",
  });

  const { data: balance } = useQuery({
    queryKey: ["vacaciones-balance", employeeId, anio],
    queryFn: async () => (await api.get(`/vacaciones/${employeeId}/balance?anio=${anio}`)).data,
    enabled: !!employeeId,
  });

  const [form, setForm] = useState({ fechaDesde: "", fechaHasta: "", diasTomados: "" });
  const crear = useMutation({
    mutationFn: async () =>
      api.post("/vacaciones", {
        employeeId,
        anioCorrespondiente: anio,
        fechaDesde: form.fechaDesde,
        fechaHasta: form.fechaHasta,
        diasTomados: Number(form.diasTomados),
      }),
    onSuccess: () => {
      invalidarAsistenciaRelacionada(queryClient);
      setForm({ fechaDesde: "", fechaHasta: "", diasTomados: "" });
    },
  });

  return (
    <div>
      <h1 className="page-header mb-6">Vacaciones</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setVista("empleado")}
          className={`px-4 py-2 rounded-md text-sm ${vista === "empleado" ? "bg-primary text-white" : "bg-white text-slate-600"}`}
        >
          Por empleado
        </button>
        <button
          onClick={() => setVista("historial")}
          className={`px-4 py-2 rounded-md text-sm ${vista === "historial" ? "bg-primary text-white" : "bg-white text-slate-600"}`}
        >
          Historial
        </button>
      </div>

      {vista === "historial" && (
        <div className="card p-5">
          <h2 className="font-medium text-slate-700 mb-3">Historial de vacaciones (todo el personal)</h2>
          {cargandoHistorial ? (
            <p className="text-slate-500 text-sm">Cargando...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2">Legajo</th>
                  <th className="pb-2">Empleado</th>
                  <th className="pb-2">Año</th>
                  <th className="pb-2">Desde</th>
                  <th className="pb-2">Hasta</th>
                  <th className="pb-2">Días</th>
                </tr>
              </thead>
              <tbody>
                {historial?.map((p) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2">{p.employee.legajo}</td>
                    <td className="py-2">
                      {p.employee.apellido}, {p.employee.nombre}
                    </td>
                    <td className="py-2">{p.anioCorrespondiente}</td>
                    <td className="py-2">{new Date(p.fechaDesde).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                    <td className="py-2">{new Date(p.fechaHasta).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                    <td className="py-2">{p.diasTomados}</td>
                  </tr>
                ))}
                {historial?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-4 text-center text-slate-400">
                      Todavía no hay períodos de vacaciones cargados
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}

      {vista === "empleado" && (
        <>
      <div className="flex gap-4 items-end mb-6 card p-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Empleado</label>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm min-w-[220px]">
            <option value="">Seleccionar...</option>
            {empleados?.map((e) => (
              <option key={e.id} value={e.id}>
                {e.legajo} - {e.apellido}, {e.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Año</label>
          <input
            type="number"
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm w-24"
          />
        </div>
      </div>

      {employeeId && balance && (
        <>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="card p-5">
              <div className="text-sm text-slate-500">Días correspondientes</div>
              <div className="text-3xl font-semibold mt-1">{balance.correspondientes}</div>
            </div>
            <div className="card p-5">
              <div className="text-sm text-slate-500">Días tomados</div>
              <div className="text-3xl font-semibold mt-1">{balance.tomados}</div>
            </div>
            <div className="card p-5">
              <div className="text-sm text-slate-500">Días restantes</div>
              <div className="text-3xl font-semibold text-primary mt-1">{balance.restantes}</div>
            </div>
          </div>

          <div className="card p-5 mb-6">
            <h2 className="font-medium text-slate-700 mb-3">Cargar período tomado</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                crear.mutate();
              }}
              className="flex gap-3 items-end"
            >
              <div>
                <label className="block text-xs text-slate-500 mb-1">Desde</label>
                <input
                  type="date"
                  required
                  value={form.fechaDesde}
                  onChange={(e) => setForm({ ...form, fechaDesde: e.target.value })}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Hasta</label>
                <input
                  type="date"
                  required
                  value={form.fechaHasta}
                  onChange={(e) => setForm({ ...form, fechaHasta: e.target.value })}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Días</label>
                <input
                  type="number"
                  required
                  value={form.diasTomados}
                  onChange={(e) => setForm({ ...form, diasTomados: e.target.value })}
                  className="border border-slate-300 rounded-md px-2 py-1.5 text-sm w-20"
                />
              </div>
              <button type="submit" className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark">
                Guardar
              </button>
            </form>
          </div>

          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-medium text-slate-700">Períodos tomados en {anio}</h2>
              <button
                onClick={async () => {
                  const res = await api.get(`/vacaciones/export.xlsx?employeeId=${employeeId}`, { responseType: "blob" });
                  const url = URL.createObjectURL(res.data as Blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "vacaciones.xlsx";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-sm text-primary hover:underline"
              >
                Exportar
              </button>
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
                {balance.periodos.map((p: any) => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-2">{new Date(p.fechaDesde).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                    <td className="py-2">{new Date(p.fechaHasta).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                    <td className="py-2">{p.diasTomados}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
        </>
      )}
    </div>
  );
}
