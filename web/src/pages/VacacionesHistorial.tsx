import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";

interface PeriodoHistorial {
  id: string;
  anioCorrespondiente: number;
  fechaDesde: string;
  fechaHasta: string;
  diasTomados: number;
  employee: { legajo: string; nombre: string; apellido: string };
}

export default function VacacionesHistorial() {
  const { data: historial, isLoading } = useQuery({
    queryKey: ["vacaciones-historial"],
    queryFn: async () => (await api.get("/vacaciones")).data as PeriodoHistorial[],
  });

  return (
    <div>
      <h1 className="page-header mb-6">Historial de vacaciones</h1>
      <div className="card p-5">
        <h2 className="font-medium text-slate-700 mb-3">Historial de vacaciones (todo el personal)</h2>
        {isLoading ? (
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
    </div>
  );
}
