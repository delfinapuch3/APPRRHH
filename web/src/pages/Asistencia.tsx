import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { TIPOS_AUSENCIA, labelTipoAusencia } from "../lib/tiposAusencia.js";
import { invalidarAsistenciaRelacionada } from "../lib/invalidarAsistencia.js";

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Asistencia() {
  const queryClient = useQueryClient();
  const [vista, setVista] = useState<"periodo" | "dia">("periodo");
  const [desde, setDesde] = useState(firstOfMonth());
  const [hasta, setHasta] = useState(today());
  const [diaSeleccionado, setDiaSeleccionado] = useState(today());
  const [seleccion, setSeleccion] = useState<{ employeeId: string; fecha: string; nombre: string } | null>(null);
  const [tipo, setTipo] = useState<string>("ENFERMEDAD_ACCIDENTE_INCULPABLE");
  const [justificada, setJustificada] = useState(true);
  const [observaciones, setObservaciones] = useState("");

  const { data: resumen, isLoading } = useQuery({
    queryKey: ["asistencia-resumen", desde, hasta],
    queryFn: async () => (await api.get(`/asistencia/resumen?desde=${desde}&hasta=${hasta}`)).data,
    enabled: vista === "periodo",
  });

  const { data: faltas } = useQuery({
    queryKey: ["faltas-sin-clasificar", desde, hasta],
    queryFn: async () => (await api.get(`/asistencia/faltas-sin-clasificar?desde=${desde}&hasta=${hasta}`)).data as any[],
    enabled: vista === "periodo",
  });

  const { data: rosterDia, isLoading: cargandoDia } = useQuery({
    queryKey: ["asistencia-dia", diaSeleccionado],
    queryFn: async () => (await api.get(`/asistencia/dia?fecha=${diaSeleccionado}`)).data as { empleados: any[] },
    enabled: vista === "dia",
  });

  const clasificar = useMutation({
    mutationFn: async () =>
      api.post("/ausencias", {
        employeeId: seleccion!.employeeId,
        fechaDesde: seleccion!.fecha,
        fechaHasta: seleccion!.fecha,
        tipo: justificada ? tipo : "INJUSTIFICADA",
        justificada,
        observaciones: observaciones || undefined,
      }),
    onSuccess: () => {
      invalidarAsistenciaRelacionada(queryClient);
      setSeleccion(null);
      setObservaciones("");
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Asistencia</h1>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setVista("periodo")}
          className={`px-4 py-2 rounded-md text-sm ${vista === "periodo" ? "bg-primary text-white" : "bg-white text-slate-600"}`}
        >
          Por período
        </button>
        <button
          onClick={() => setVista("dia")}
          className={`px-4 py-2 rounded-md text-sm ${vista === "dia" ? "bg-primary text-white" : "bg-white text-slate-600"}`}
        >
          Por día
        </button>
      </div>

      {vista === "periodo" && (
        <>
          <div className="flex gap-4 items-end mb-6 bg-white rounded-lg shadow-sm p-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Desde</label>
              <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Hasta</label>
              <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
            </div>
            <div className="text-sm text-slate-500 ml-auto flex items-center gap-4">
              % asistencia general: <span className="font-semibold text-slate-800">{resumen?.porcentajeGeneral ?? "-"}%</span>
              <button
                onClick={async () => {
                  const res = await api.get(`/ausencias/export.xlsx?desde=${desde}&hasta=${hasta}`, { responseType: "blob" });
                  const url = URL.createObjectURL(res.data as Blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "ausencias.xlsx";
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="text-primary hover:underline"
              >
                Exportar ausencias
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
            <h2 className="font-medium text-slate-700 mb-3">Faltas sin clasificar ({faltas?.length ?? 0})</h2>
            {faltas?.length === 0 && <p className="text-sm text-slate-500">No hay faltas pendientes de clasificar en el período.</p>}
            {faltas && faltas.length > 0 && (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="pb-2">Fecha</th>
                    <th className="pb-2">Empleado</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {faltas.map((f) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="py-2">{new Date(f.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                      <td className="py-2">
                        {f.employee.apellido}, {f.employee.nombre} ({f.employee.legajo})
                      </td>
                      <td className="py-2 text-right">
                        <button
                          onClick={() =>
                            setSeleccion({
                              employeeId: f.employeeId,
                              fecha: f.fecha.slice(0, 10),
                              nombre: `${f.employee.apellido}, ${f.employee.nombre}`,
                            })
                          }
                          className="text-slate-700 underline text-sm"
                        >
                          Clasificar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5">
            <h2 className="font-medium text-slate-700 mb-3">Asistencia por empleado</h2>
            {isLoading ? (
              <p className="text-slate-500 text-sm">Cargando...</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="pb-2">Legajo</th>
                    <th className="pb-2">Nombre</th>
                    <th className="pb-2">Días esperados</th>
                    <th className="pb-2">Presentes</th>
                    <th className="pb-2">Justificadas</th>
                    <th className="pb-2">Injustificadas</th>
                    <th className="pb-2">Sin clasificar</th>
                    <th className="pb-2">% Asistencia</th>
                  </tr>
                </thead>
                <tbody>
                  {resumen?.empleados.map((e: any) => (
                    <tr key={e.employeeId} className="border-b last:border-0">
                      <td className="py-2">{e.legajo}</td>
                      <td className="py-2">{e.nombre}</td>
                      <td className="py-2">{e.diasEsperados}</td>
                      <td className="py-2">{e.presentes}</td>
                      <td className="py-2">{e.ausenciasJustificadas}</td>
                      <td className="py-2 text-red-600">{e.ausenciasInjustificadas}</td>
                      <td className="py-2 text-amber-600">{e.ausenciasSinClasificar}</td>
                      <td className="py-2 font-medium">{e.porcentajeAsistencia}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {vista === "dia" && (
        <>
          <div className="flex gap-4 items-end mb-6 bg-white rounded-lg shadow-sm p-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Día</label>
              <input
                type="date"
                value={diaSeleccionado}
                onChange={(e) => setDiaSeleccionado(e.target.value)}
                className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-5">
            <h2 className="font-medium text-slate-700 mb-3">
              Quién faltó el {new Date(diaSeleccionado).toLocaleDateString("es-AR", { timeZone: "UTC" })}
            </h2>
            {cargandoDia ? (
              <p className="text-slate-500 text-sm">Cargando...</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b">
                    <th className="pb-2">Legajo</th>
                    <th className="pb-2">Nombre</th>
                    <th className="pb-2">Estado</th>
                    <th className="pb-2">Horas trabajadas</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rosterDia?.empleados.map((e) => (
                    <tr key={e.employeeId} className="border-b last:border-0">
                      <td className="py-2">{e.legajo}</td>
                      <td className="py-2">{e.nombre}</td>
                      <td className="py-2">
                        {!e.ausente ? (
                          <span className="text-primary-dark">Presente</span>
                        ) : e.justificada === true ? (
                          <span className="text-slate-600">Ausente · {labelTipoAusencia(e.tipoAusencia)}</span>
                        ) : e.justificada === false ? (
                          <span className="text-red-600">Ausente injustificado</span>
                        ) : (
                          <span className="text-amber-600">Ausente sin clasificar</span>
                        )}
                      </td>
                      <td className="py-2">{e.horasTrabajadas.toFixed(1)}</td>
                      <td className="py-2 text-right">
                        {e.ausente && e.justificada === null && (
                          <button
                            onClick={() => setSeleccion({ employeeId: e.employeeId, fecha: diaSeleccionado, nombre: e.nombre })}
                            className="text-slate-700 underline text-sm"
                          >
                            Clasificar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {seleccion && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center" onClick={() => setSeleccion(null)}>
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-medium text-slate-800 mb-1">Clasificar falta</h3>
            <p className="text-sm text-slate-500 mb-4">
              {seleccion.nombre} · {new Date(seleccion.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })}
            </p>
            <label className="block text-xs text-slate-500 mb-1">¿La falta está justificada?</label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setJustificada(true)}
                className={`flex-1 py-1.5 rounded-md text-sm ${justificada ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}
              >
                Justificada
              </button>
              <button
                onClick={() => setJustificada(false)}
                className={`flex-1 py-1.5 rounded-md text-sm ${!justificada ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                Injustificada
              </button>
            </div>
            {justificada && (
              <div className="mb-3">
                <label className="block text-xs text-slate-500 mb-1">Motivo</label>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm">
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
                Observaciones {justificada && tipo === "OTRA" ? "(obligatorio: aclarar el motivo)" : ""}
              </label>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setSeleccion(null)} className="px-4 py-2 text-sm text-slate-600">
                Cancelar
              </button>
              <button
                onClick={() => clasificar.mutate()}
                disabled={justificada && tipo === "OTRA" && !observaciones.trim()}
                className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
