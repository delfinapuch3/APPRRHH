import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";

interface Empresa {
  id: string;
  nombre: string;
}
interface Sector {
  id: string;
  nombre: string;
  empresaId: string | null;
}

interface ResumenHoy {
  totalActivos: number;
  presentes: { cantidad: number; porcentaje: number };
  ausentes: { cantidad: number; porcentaje: number };
  tardes: { cantidad: number; porcentaje: number };
  vacaciones: { cantidad: number; porcentaje: number };
}

interface TopAusencia {
  employeeId: string;
  legajo: string;
  nombre: string;
  ausencias: number;
}

interface HorasSector {
  sectorId: string;
  sector: string;
  horasTrabajadas: number;
  horasTeoricas: number;
}

interface HorasExtraSector {
  sectorId: string;
  sector: string;
  horasExtra50: number;
  horasExtra100: number;
  montoExtra50: number;
  montoExtra100: number;
}

function Gauge({ porcentaje, color }: { porcentaje: number; color: string }) {
  const r = 26;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(porcentaje, 100) / 100) * circ;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64">
      <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="6" />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 32 32)"
      />
      <text x="32" y="37" textAnchor="middle" fontSize="14" fontWeight="600" fill="#fff">
        {porcentaje}%
      </text>
    </svg>
  );
}

function StatCard({
  titulo,
  cantidad,
  porcentaje,
  bg,
  ring,
  icon,
}: {
  titulo: string;
  cantidad: number;
  porcentaje: number;
  bg: string;
  ring: string;
  icon: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl p-5 flex items-center justify-between text-white ${bg}`}>
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">{icon}</div>
        <div>
          <div className="text-sm opacity-90">{titulo}</div>
          <div className="text-3xl font-bold">{cantidad}</div>
        </div>
      </div>
      <Gauge porcentaje={porcentaje} color={ring} />
    </div>
  );
}

const ICONO_PRESENTE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM17 11l2 2 4-4" />
  </svg>
);
const ICONO_AUSENTE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM17 8l4 4m0-4l-4 4" />
  </svg>
);
const ICONO_TARDE = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
const ICONO_VACACIONES = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 19l9-9m0 0l4-4m-4 4l-4-4m4 4l4 4M5 19l4-4" />
  </svg>
);

const PERIODOS = [
  ["mes", "Mes en curso"],
  ["7", "Últimos 7 días"],
  ["15", "Últimos 15 días"],
  ["30", "Últimos 30 días"],
] as const;

export default function Dashboard() {
  const { user } = useAuth();
  const [empresaId, setEmpresaId] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [periodoHoras, setPeriodoHoras] = useState("mes");
  const [periodoExtra, setPeriodoExtra] = useState("mes");

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => (await api.get("/empresas")).data as Empresa[],
  });
  const { data: sectores } = useQuery({
    queryKey: ["sectores"],
    queryFn: async () => (await api.get("/sectores")).data as Sector[],
  });
  const sectoresFiltrados = sectores?.filter((s) => !empresaId || s.empresaId === empresaId);

  function buildQS(params: Record<string, string | undefined>) {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
    const s = qs.toString();
    return s ? `?${s}` : "";
  }

  const { data: resumen } = useQuery({
    queryKey: ["dashboard-resumen-hoy", empresaId, sectorId],
    queryFn: async () => (await api.get(`/dashboard/resumen-hoy${buildQS({ empresaId, sectorId })}`)).data as ResumenHoy,
  });
  const { data: topAusencias } = useQuery({
    queryKey: ["dashboard-top-ausencias", empresaId, sectorId],
    queryFn: async () => (await api.get(`/dashboard/top-ausencias${buildQS({ empresaId, sectorId })}`)).data as TopAusencia[],
  });
  const { data: horasSector } = useQuery({
    queryKey: ["dashboard-horas-sector", empresaId, periodoHoras],
    queryFn: async () => (await api.get(`/dashboard/horas-por-sector${buildQS({ empresaId, periodo: periodoHoras })}`)).data as HorasSector[],
  });
  const { data: horasExtraSector } = useQuery({
    queryKey: ["dashboard-horas-extra-sector", empresaId, periodoExtra],
    queryFn: async () =>
      (await api.get(`/dashboard/horas-extra-por-sector${buildQS({ empresaId, periodo: periodoExtra })}`)).data as HorasExtraSector[],
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-1">Hola, {user?.nombre}</h1>
      <p className="text-slate-500 mb-6">Resumen general</p>

      <div className="flex gap-4 mb-6 bg-white rounded-lg shadow-sm p-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Empresa</label>
          <select
            value={empresaId}
            onChange={(e) => {
              setEmpresaId(e.target.value);
              setSectorId("");
            }}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm min-w-[160px]"
          >
            <option value="">Todas</option>
            {empresas?.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Sector</label>
          <select value={sectorId} onChange={(e) => setSectorId(e.target.value)} className="border border-slate-300 rounded-md px-2 py-1.5 text-sm min-w-[160px]">
            <option value="">Todos</option>
            {sectoresFiltrados?.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <StatCard
          titulo="Presentes"
          cantidad={resumen?.presentes.cantidad ?? 0}
          porcentaje={resumen?.presentes.porcentaje ?? 0}
          bg="bg-primary"
          ring="#0f5132"
          icon={ICONO_PRESENTE}
        />
        <StatCard
          titulo="Ausentes"
          cantidad={resumen?.ausentes.cantidad ?? 0}
          porcentaje={resumen?.ausentes.porcentaje ?? 0}
          bg="bg-rose-500"
          ring="#7a1f2b"
          icon={ICONO_AUSENTE}
        />
        <StatCard
          titulo="Tardes"
          cantidad={resumen?.tardes.cantidad ?? 0}
          porcentaje={resumen?.tardes.porcentaje ?? 0}
          bg="bg-accent"
          ring="#8a5a12"
          icon={ICONO_TARDE}
        />
        <StatCard
          titulo="Vacaciones"
          cantidad={resumen?.vacaciones.cantidad ?? 0}
          porcentaje={resumen?.vacaciones.porcentaje ?? 0}
          bg="bg-violet-400"
          ring="#4c2a8f"
          icon={ICONO_VACACIONES}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
        <h2 className="font-medium text-slate-700 mb-3">Top 10 ausencias (mes en curso)</h2>
        {topAusencias?.length === 0 && <p className="text-sm text-slate-500">Sin ausencias registradas.</p>}
        {topAusencias && topAusencias.length > 0 && (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Legajo</th>
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Ausencias</th>
              </tr>
            </thead>
            <tbody>
              {topAusencias.map((a) => (
                <tr key={a.employeeId} className="border-b last:border-0">
                  <td className="py-2">{a.legajo}</td>
                  <td className="py-2">
                    <Link to={`/empleados/${a.employeeId}`} className="text-slate-700 hover:underline">
                      {a.nombre}
                    </Link>
                  </td>
                  <td className="py-2 font-medium text-red-600">{a.ausencias}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-slate-700">Horas trabajadas vs Teóricas por Sector</h2>
            <select
              value={periodoHoras}
              onChange={(e) => setPeriodoHoras(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1 text-xs"
            >
              {PERIODOS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={horasSector}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sector" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="horasTrabajadas" name="Trabajadas" fill="#0ea5e9" />
              <Bar dataKey="horasTeoricas" name="Teóricas" fill="#94a3b8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-medium text-slate-700">Horas extra por Sector</h2>
            <select
              value={periodoExtra}
              onChange={(e) => setPeriodoExtra(e.target.value)}
              className="border border-slate-300 rounded-md px-2 py-1 text-xs"
            >
              {PERIODOS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={horasExtraSector}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sector" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="horasExtra50" name="Extra 50%" fill="#f59e0b" />
              <Bar dataKey="horasExtra100" name="Extra 100%" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-slate-700">Costo de horas extra por Sector ($)</h2>
          <select
            value={periodoExtra}
            onChange={(e) => setPeriodoExtra(e.target.value)}
            className="border border-slate-300 rounded-md px-2 py-1 text-xs"
          >
            {PERIODOS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={horasExtraSector}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="sector" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `$${Number(v).toLocaleString("es-AR")}`} />
            <Tooltip formatter={(v) => `$${Number(v).toLocaleString("es-AR")}`} />
            <Legend />
            <Bar dataKey="montoExtra50" name="Extra 50%" fill="#f59e0b" />
            <Bar dataKey="montoExtra100" name="Extra 100%" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
