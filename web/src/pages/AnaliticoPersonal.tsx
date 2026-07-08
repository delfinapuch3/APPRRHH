import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api } from "../api/client.js";

interface Resumen {
  cantidadEmpleados: number;
  ausentismo: number;
  tardanza: number;
  promedioEdad: number | null;
  promedioAntiguedad: number;
}
interface AusentismoMes {
  mes: string;
  ausentismo: number;
}
interface PorGenero {
  genero: string;
  cantidad: number;
}
interface PorAntiguedad {
  rango: string;
  cantidad: number;
}
interface PorEmpresa {
  empresa: string;
  cantidad: number;
}

const COLORES = ["#0ea5e9", "#f59e0b", "#94a3b8", "#8b5cf6", "#ef4444", "#22c55e"];

function StatCard({ titulo, valor, sufijo }: { titulo: string; valor: string | number; sufijo?: string }) {
  return (
    <div className="card p-5">
      <div className="text-sm text-slate-500">{titulo}</div>
      <div className="text-3xl font-semibold mt-1">
        {valor}
        {sufijo && <span className="text-lg text-slate-400 ml-1">{sufijo}</span>}
      </div>
    </div>
  );
}

export default function AnaliticoPersonal() {
  const { data: resumen } = useQuery({
    queryKey: ["analitico-resumen"],
    queryFn: async () => (await api.get("/analitico/resumen")).data as Resumen,
  });
  const { data: ausentismoPorMes } = useQuery({
    queryKey: ["analitico-ausentismo-por-mes"],
    queryFn: async () => (await api.get("/analitico/ausentismo-por-mes")).data as AusentismoMes[],
  });
  const { data: porGenero } = useQuery({
    queryKey: ["analitico-por-genero"],
    queryFn: async () => (await api.get("/analitico/por-genero")).data as PorGenero[],
  });
  const { data: porAntiguedad } = useQuery({
    queryKey: ["analitico-por-antiguedad"],
    queryFn: async () => (await api.get("/analitico/por-antiguedad")).data as PorAntiguedad[],
  });
  const { data: porEmpresa } = useQuery({
    queryKey: ["analitico-por-empresa"],
    queryFn: async () => (await api.get("/analitico/por-empresa")).data as PorEmpresa[],
  });

  return (
    <div>
      <h1 className="page-header mb-6">Analítico de personal</h1>

      <div className="grid grid-cols-5 gap-4 mb-6">
        <StatCard titulo="Empleados" valor={resumen?.cantidadEmpleados ?? "-"} />
        <StatCard titulo="Ausentismo" valor={resumen?.ausentismo ?? "-"} sufijo="%" />
        <StatCard titulo="Tardanza" valor={resumen?.tardanza ?? "-"} sufijo="%" />
        <StatCard titulo="Edad promedio" valor={resumen?.promedioEdad ?? "-"} sufijo="años" />
        <StatCard titulo="Antigüedad promedio" valor={resumen?.promedioAntiguedad ?? "-"} sufijo="años" />
      </div>

      <div className="card p-5 mb-6">
        <h2 className="font-medium text-slate-700 mb-3">Índice de ausentismo por mes</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={ausentismoPorMes}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${v}%`} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Line type="monotone" dataKey="ausentismo" name="Ausentismo" stroke="#ef4444" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h2 className="font-medium text-slate-700 mb-3">Empleados por género</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porGenero} dataKey="cantidad" nameKey="genero" cx="50%" cy="50%" outerRadius={90} label>
                {porGenero?.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
          <h2 className="font-medium text-slate-700 mb-3">Empleados por empresa</h2>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={porEmpresa} dataKey="cantidad" nameKey="empresa" cx="50%" cy="50%" outerRadius={90} label>
                {porEmpresa?.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-medium text-slate-700 mb-3">Empleados por antigüedad</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={porAntiguedad}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="rango" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="cantidad" name="Empleados" fill="#0ea5e9" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
