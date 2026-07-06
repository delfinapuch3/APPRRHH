import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";

interface ResumenEmpleado {
  employeeId: string;
  legajo: string;
  nombre: string;
  diasEsperados: number;
  presentes: number;
  ausenciasJustificadas: number;
  ausenciasInjustificadas: number;
  ausenciasSinClasificar: number;
  porcentajeAsistencia: number;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["asistencia-resumen"],
    queryFn: async () => (await api.get("/asistencia/resumen")).data as { porcentajeGeneral: number; empleados: ResumenEmpleado[] },
  });

  const { data: faltas } = useQuery({
    queryKey: ["faltas-sin-clasificar"],
    queryFn: async () => (await api.get("/asistencia/faltas-sin-clasificar")).data as unknown[],
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Hola, {user?.nombre}</h1>
      <p className="text-slate-500 mb-6">Resumen del mes en curso</p>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="text-sm text-slate-500">% Asistencia general</div>
          <div className="text-3xl font-semibold text-slate-800 mt-1">
            {isLoading ? "..." : `${data?.porcentajeGeneral ?? 0}%`}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="text-sm text-slate-500">Empleados activos</div>
          <div className="text-3xl font-semibold text-slate-800 mt-1">{data?.empleados.length ?? "..."}</div>
        </div>
        <Link to="/asistencia" className="bg-white rounded-lg shadow-sm p-5 hover:shadow-md transition">
          <div className="text-sm text-slate-500">Faltas sin clasificar</div>
          <div className="text-3xl font-semibold text-amber-600 mt-1">{faltas?.length ?? "..."}</div>
        </Link>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-5">
        <h2 className="font-medium text-slate-700 mb-4">Asistencia por empleado</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="pb-2">Legajo</th>
              <th className="pb-2">Nombre</th>
              <th className="pb-2">Presentes</th>
              <th className="pb-2">Justificadas</th>
              <th className="pb-2">Injustificadas</th>
              <th className="pb-2">% Asistencia</th>
            </tr>
          </thead>
          <tbody>
            {data?.empleados.map((e) => (
              <tr key={e.employeeId} className="border-b last:border-0">
                <td className="py-2">{e.legajo}</td>
                <td className="py-2">
                  <Link to={`/empleados/${e.employeeId}`} className="text-slate-700 hover:underline">
                    {e.nombre}
                  </Link>
                </td>
                <td className="py-2">{e.presentes}</td>
                <td className="py-2">{e.ausenciasJustificadas}</td>
                <td className="py-2 text-red-600">{e.ausenciasInjustificadas}</td>
                <td className="py-2 font-medium">{e.porcentajeAsistencia}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
