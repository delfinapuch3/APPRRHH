import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

interface AusenciaInjustificada {
  id: string;
  fechaDesde: string;
  fechaHasta: string;
  observaciones: string | null;
  employee: { legajo: string; nombre: string; apellido: string };
  cargadoPor: { nombre: string };
}

export default function Ausencias() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  function buildQS() {
    const qs = new URLSearchParams({ justificada: "false" });
    if (desde) qs.set("desde", desde);
    if (hasta) qs.set("hasta", hasta);
    return qs.toString();
  }

  const { data: ausencias, isLoading } = useQuery({
    queryKey: ["ausencias-injustificadas", desde, hasta],
    queryFn: async () => (await api.get(`/ausencias?${buildQS()}`)).data as AusenciaInjustificada[],
  });

  return (
    <div>
      <h1 className="page-header mb-6">Ausencias</h1>

      <div className="flex gap-4 items-end mb-6 card p-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm" />
        </div>
        <button
          onClick={async () => {
            const res = await api.get(`/ausencias/export.xlsx?${buildQS()}`, { responseType: "blob" });
            const url = URL.createObjectURL(res.data as Blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "ausencias-injustificadas.xlsx";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="text-sm text-primary hover:underline ml-auto"
        >
          Exportar
        </button>
      </div>

      <div className="card p-5">
        <h2 className="font-medium text-slate-700 mb-3">Historial de ausencias injustificadas ({ausencias?.length ?? 0})</h2>
        {isLoading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : ausencias?.length === 0 ? (
          <p className="text-sm text-slate-500">No hay ausencias injustificadas registradas en el período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Legajo</th>
                <th className="pb-2">Empleado</th>
                <th className="pb-2">Desde</th>
                <th className="pb-2">Hasta</th>
                <th className="pb-2">Observaciones</th>
                <th className="pb-2">Cargado por</th>
              </tr>
            </thead>
            <tbody>
              {ausencias?.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="py-2">{a.employee.legajo}</td>
                  <td className="py-2">
                    {a.employee.apellido}, {a.employee.nombre}
                  </td>
                  <td className="py-2 text-red-600">{new Date(a.fechaDesde).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                  <td className="py-2">{new Date(a.fechaHasta).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                  <td className="py-2 text-slate-500">{a.observaciones ?? "-"}</td>
                  <td className="py-2 text-slate-500">{a.cargadoPor.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
