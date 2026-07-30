import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { InfoTip } from "../components/InfoTip.js";
import { invalidarAsistenciaRelacionada } from "../lib/invalidarAsistencia.js";
import { useConfirm } from "../components/ConfirmProvider.js";

const ESTADOS = ["PENDIENTE", "TOMADO"] as const;

interface Franco {
  id: string;
  employee: { legajo: string; nombre: string; apellido: string };
  fechaGenerado: string;
  horas: number;
  estado: string;
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Francos() {
  const queryClient = useQueryClient();
  const confirmar = useConfirm();
  const [estado, setEstado] = useState<string>("");
  const [desde, setDesde] = useState(firstOfMonth());
  const [hasta, setHasta] = useState(today());

  function queryParams() {
    const params = new URLSearchParams();
    if (estado) params.set("estado", estado);
    if (desde) params.set("desde", desde);
    if (hasta) params.set("hasta", hasta);
    return params.toString();
  }

  const { data: francos, isLoading } = useQuery({
    queryKey: ["francos-list", estado, desde, hasta],
    queryFn: async () => (await api.get(`/francos?${queryParams()}`)).data as Franco[],
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, nuevoEstado }: { id: string; nuevoEstado: string }) =>
      api.put(`/francos/${id}`, { estado: nuevoEstado, ...(nuevoEstado === "TOMADO" ? { fechaTomado: new Date().toISOString() } : {}) }),
    onSuccess: () => invalidarAsistenciaRelacionada(queryClient),
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => api.delete(`/francos/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["francos-list"] });
      invalidarAsistenciaRelacionada(queryClient);
    },
  });

  async function confirmarEliminar(f: Franco) {
    const ok = await confirmar({
      titulo: "Eliminar franco compensatorio",
      mensaje: `¿Eliminar el franco de ${f.employee.apellido}, ${f.employee.nombre} generado el ${new Date(f.fechaGenerado).toLocaleDateString("es-AR", { timeZone: "UTC" })}? Esta acción no se puede deshacer. Si el día que lo generó sigue vigente, puede volver a crearse solo la próxima vez que se recalculen las horas de ese empleado.`,
      textoConfirmar: "Eliminar",
      peligro: true,
    });
    if (ok) eliminar.mutate(f.id);
  }

  async function exportar() {
    const res = await api.get(`/francos/export.xlsx?${queryParams()}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "francos.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-header flex items-center gap-2">
          Francos compensatorios
          <InfoTip texto="Días de descanso que genera el sistema cuando un empleado trabaja un domingo o feriado. Podés marcarlos como tomados; los que no, se pagan en la liquidación." />
        </h1>
        <button onClick={exportar} className="text-sm text-primary hover:underline">
          Exportar
        </button>
      </div>

      <div className="mb-4 flex gap-2 items-end flex-wrap">
        {["", ...ESTADOS].map((e) => (
          <button
            key={e}
            onClick={() => setEstado(e)}
            className={`px-3 py-1.5 rounded-md text-sm ${estado === e ? "bg-primary text-white" : "bg-white text-slate-600"}`}
          >
            {e || "Todos"}
          </button>
        ))}
        <div className="ml-4">
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
        {(desde || hasta) && (
          <button
            onClick={() => {
              setDesde("");
              setHasta("");
            }}
            className="text-sm text-slate-500 hover:underline"
          >
            Quitar filtro de fecha
          </button>
        )}
      </div>

      <div className="card p-5">
        {isLoading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Legajo</th>
                <th className="pb-2">Empleado</th>
                <th className="pb-2">Generado el</th>
                <th className="pb-2">Horas</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {francos?.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="py-2">{f.employee.legajo}</td>
                  <td className="py-2">
                    {f.employee.apellido}, {f.employee.nombre}
                  </td>
                  <td className="py-2">{new Date(f.fechaGenerado).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                  <td className="py-2">{f.horas}</td>
                  <td className="py-2">{f.estado}</td>
                  <td className="py-2 text-right">
                    {f.estado === "PENDIENTE" && (
                      <button
                        onClick={() => actualizar.mutate({ id: f.id, nuevoEstado: "TOMADO" })}
                        className="text-slate-700 underline text-sm"
                      >
                        Marcar tomado
                      </button>
                    )}
                    <button onClick={() => confirmarEliminar(f)} className="text-red-600 underline text-sm ml-3">
                      Eliminar
                    </button>
                  </td>
                </tr>
              ))}
              {francos?.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-center text-slate-400">
                    No hay francos en el período elegido.
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
