import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { labelTipoAusencia } from "../lib/tiposAusencia.js";

interface Licencia {
  id: string;
  fechaDesde: string;
  fechaHasta: string;
  tipo: string;
  observaciones: string | null;
  employee: { legajo: string; nombre: string; apellido: string };
  cargadoPor: { nombre: string };
}

export default function Licencias() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  function buildQS() {
    const qs = new URLSearchParams({ justificada: "true", excluirTipo: "VACACIONES" });
    if (desde) qs.set("desde", desde);
    if (hasta) qs.set("hasta", hasta);
    return qs.toString();
  }

  const { data: licencias, isLoading } = useQuery({
    queryKey: ["licencias", desde, hasta],
    queryFn: async () => (await api.get(`/ausencias?${buildQS()}`)).data as Licencia[],
  });

  return (
    <div>
      <h1 className="page-header mb-6">Licencias</h1>

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
            a.download = "licencias.xlsx";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="text-sm text-primary hover:underline ml-auto"
        >
          Exportar
        </button>
      </div>

      <div className="card p-5">
        <h2 className="font-medium text-slate-700 mb-3">Historial de licencias justificadas ({licencias?.length ?? 0})</h2>
        {isLoading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : licencias?.length === 0 ? (
          <p className="text-sm text-slate-500">No hay licencias registradas en el período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Legajo</th>
                <th className="pb-2">Empleado</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Desde</th>
                <th className="pb-2">Hasta</th>
                <th className="pb-2">Observaciones</th>
                <th className="pb-2">Cargado por</th>
              </tr>
            </thead>
            <tbody>
              {licencias?.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2">{l.employee.legajo}</td>
                  <td className="py-2">
                    {l.employee.apellido}, {l.employee.nombre}
                  </td>
                  <td className="py-2">{labelTipoAusencia(l.tipo)}</td>
                  <td className="py-2">{new Date(l.fechaDesde).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                  <td className="py-2">{new Date(l.fechaHasta).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                  <td className="py-2 text-slate-500">{l.observaciones ?? "-"}</td>
                  <td className="py-2 text-slate-500">{l.cargadoPor.nombre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
