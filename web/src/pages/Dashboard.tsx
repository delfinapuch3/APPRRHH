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

interface TopTardanza {
  employeeId: string;
  legajo: string;
  nombre: string;
  tardanzas: number;
  retirosAnticipados: number;
  total: number;
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

interface EmpleadoResumen {
  employeeId: string;
  legajo: string;
  nombre: string;
  sector: string | null;
}

interface DetalleHoy {
  presentes: EmpleadoResumen[];
  ausentes: EmpleadoResumen[];
  tardes: EmpleadoResumen[];
  vacaciones: EmpleadoResumen[];
}

type CategoriaHoy = keyof DetalleHoy;

interface DetalleSectorEmpleado {
  employeeId: string;
  legajo: string;
  nombre: string;
  horasTrabajadas: number;
  horasTeoricas: number;
  horasExtra50: number;
  horasExtra100: number;
  montoExtra50: number;
  montoExtra100: number;
}

interface DetalleSector {
  sector: string;
  empleados: DetalleSectorEmpleado[];
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
  onClick,
}: {
  titulo: string;
  cantidad: number;
  porcentaje: number;
  bg: string;
  ring: string;
  icon: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-5 flex items-center justify-between text-white text-left w-full transition hover:brightness-110 ${bg}`}
    >
      <div className="flex items-center gap-4">
        <div className="w-11 h-11 rounded-full bg-white/20 flex items-center justify-center">{icon}</div>
        <div>
          <div className="text-sm opacity-90">{titulo}</div>
          <div className="text-3xl font-bold">{cantidad}</div>
        </div>
      </div>
      <Gauge porcentaje={porcentaje} color={ring} />
    </button>
  );
}

function ModalListaEmpleados({
  titulo,
  empleados,
  onClose,
}: {
  titulo: string;
  empleados: EmpleadoResumen[] | undefined;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-slate-800">{titulo}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            &times;
          </button>
        </div>
        {!empleados ? (
          <p className="text-sm text-slate-500">Cargando...</p>
        ) : empleados.length === 0 ? (
          <p className="text-sm text-slate-500">Sin resultados.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Legajo</th>
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Sector</th>
              </tr>
            </thead>
            <tbody>
              {empleados.map((e) => (
                <tr key={e.employeeId} className="border-b last:border-0">
                  <td className="py-2">{e.legajo}</td>
                  <td className="py-2">
                    <Link to={`/empleados/${e.employeeId}`} className="text-slate-700 hover:underline" onClick={onClose}>
                      {e.nombre}
                    </Link>
                  </td>
                  <td className="py-2 text-slate-500">{e.sector ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ModalDetalleSector({
  titulo,
  detalle,
  onClose,
}: {
  titulo: string;
  detalle: DetalleSector | undefined;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-medium text-slate-800">{titulo}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">
            &times;
          </button>
        </div>
        {!detalle ? (
          <p className="text-sm text-slate-500">Cargando...</p>
        ) : detalle.empleados.length === 0 ? (
          <p className="text-sm text-slate-500">Sin datos en el período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Legajo</th>
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Trabajadas</th>
                <th className="pb-2">Teóricas</th>
                <th className="pb-2">Extra 50%</th>
                <th className="pb-2">Extra 100%</th>
                <th className="pb-2">$ Extra</th>
              </tr>
            </thead>
            <tbody>
              {detalle.empleados.map((e) => (
                <tr key={e.employeeId} className="border-b last:border-0">
                  <td className="py-2">{e.legajo}</td>
                  <td className="py-2">
                    <Link to={`/empleados/${e.employeeId}`} className="text-slate-700 hover:underline" onClick={onClose}>
                      {e.nombre}
                    </Link>
                  </td>
                  <td className="py-2">{e.horasTrabajadas}</td>
                  <td className="py-2 text-slate-500">{e.horasTeoricas}</td>
                  <td className="py-2">{e.horasExtra50 || "-"}</td>
                  <td className="py-2">{e.horasExtra100 || "-"}</td>
                  <td className="py-2">
                    {e.montoExtra50 + e.montoExtra100 > 0 ? `$${(e.montoExtra50 + e.montoExtra100).toLocaleString("es-AR")}` : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
  const [categoriaHoy, setCategoriaHoy] = useState<CategoriaHoy | null>(null);
  const [sectorSeleccionado, setSectorSeleccionado] = useState<{ sectorId: string; periodo: string } | null>(null);

  const { data: empresas } = useQuery({
    queryKey: ["empresas"],
    queryFn: async () => (await api.get("/empresas")).data as Empresa[],
  });
  const { data: sectores } = useQuery({
    queryKey: ["sectores"],
    queryFn: async () => (await api.get("/sectores")).data as Sector[],
  });

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
  const { data: topTardanzas } = useQuery({
    queryKey: ["dashboard-top-tardanzas", empresaId, sectorId],
    queryFn: async () => (await api.get(`/dashboard/top-tardanzas${buildQS({ empresaId, sectorId })}`)).data as TopTardanza[],
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
  const { data: detalleHoy } = useQuery({
    queryKey: ["dashboard-detalle-hoy", empresaId, sectorId],
    queryFn: async () => (await api.get(`/dashboard/detalle-hoy${buildQS({ empresaId, sectorId })}`)).data as DetalleHoy,
    enabled: categoriaHoy !== null,
  });
  const { data: detalleSector } = useQuery({
    queryKey: ["dashboard-detalle-sector", sectorSeleccionado?.sectorId, sectorSeleccionado?.periodo, empresaId],
    queryFn: async () =>
      (
        await api.get(
          `/dashboard/detalle-sector${buildQS({ sectorId: sectorSeleccionado!.sectorId, periodo: sectorSeleccionado!.periodo, empresaId })}`
        )
      ).data as DetalleSector,
    enabled: sectorSeleccionado !== null,
  });

  const TITULOS_CATEGORIA: Record<CategoriaHoy, string> = {
    presentes: "Presentes hoy",
    ausentes: "Ausentes hoy",
    tardes: "Tardanzas hoy",
    vacaciones: "Vacaciones hoy",
  };

  return (
    <div>
      <style>{`.recharts-bar-rectangle:hover { cursor: pointer; opacity: 0.85; }`}</style>
      <h1 className="page-header mb-1">Hola, {user?.nombre}</h1>
      <p className="text-slate-500 mb-6">Resumen general</p>

      <div className="flex gap-4 mb-6 card p-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Empresa</label>
          <select
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
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
            {sectores?.map((s) => (
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
          onClick={() => setCategoriaHoy("presentes")}
        />
        <StatCard
          titulo="Ausentes"
          cantidad={resumen?.ausentes.cantidad ?? 0}
          porcentaje={resumen?.ausentes.porcentaje ?? 0}
          bg="bg-rose-500"
          ring="#7a1f2b"
          icon={ICONO_AUSENTE}
          onClick={() => setCategoriaHoy("ausentes")}
        />
        <StatCard
          titulo="Tardes"
          cantidad={resumen?.tardes.cantidad ?? 0}
          porcentaje={resumen?.tardes.porcentaje ?? 0}
          bg="bg-accent"
          ring="#8a5a12"
          icon={ICONO_TARDE}
          onClick={() => setCategoriaHoy("tardes")}
        />
        <StatCard
          titulo="Vacaciones"
          cantidad={resumen?.vacaciones.cantidad ?? 0}
          porcentaje={resumen?.vacaciones.porcentaje ?? 0}
          bg="bg-violet-400"
          onClick={() => setCategoriaHoy("vacaciones")}
          ring="#4c2a8f"
          icon={ICONO_VACACIONES}
        />
      </div>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
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

        <div className="card p-5">
          <h2 className="font-medium text-slate-700 mb-3">Top 10 llegadas tarde / salidas tempranas (mes en curso)</h2>
          {topTardanzas?.length === 0 && <p className="text-sm text-slate-500">Sin tardanzas ni retiros anticipados registrados.</p>}
          {topTardanzas && topTardanzas.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2">Legajo</th>
                  <th className="pb-2">Nombre</th>
                  <th className="pb-2">Tarde</th>
                  <th className="pb-2">Retiro ant.</th>
                </tr>
              </thead>
              <tbody>
                {topTardanzas.map((t) => (
                  <tr key={t.employeeId} className="border-b last:border-0">
                    <td className="py-2">{t.legajo}</td>
                    <td className="py-2">
                      <Link to={`/empleados/${t.employeeId}`} className="text-slate-700 hover:underline">
                        {t.nombre}
                      </Link>
                    </td>
                    <td className="py-2 font-medium text-amber-600">{t.tardanzas || "-"}</td>
                    <td className="py-2 font-medium text-orange-600">{t.retirosAnticipados || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card p-5">
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
              <Bar
                dataKey="horasTrabajadas"
                name="Trabajadas"
                fill="#0ea5e9"
                onClick={(data) => setSectorSeleccionado({ sectorId: data.payload.sectorId, periodo: periodoHoras })}
              />
              <Bar
                dataKey="horasTeoricas"
                name="Teóricas"
                fill="#94a3b8"
                onClick={(data) => setSectorSeleccionado({ sectorId: data.payload.sectorId, periodo: periodoHoras })}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card p-5">
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
              <Bar
                dataKey="horasExtra50"
                name="Extra 50%"
                fill="#f59e0b"
                onClick={(data) => setSectorSeleccionado({ sectorId: data.payload.sectorId, periodo: periodoExtra })}
              />
              <Bar
                dataKey="horasExtra100"
                name="Extra 100%"
                fill="#ef4444"
                onClick={(data) => setSectorSeleccionado({ sectorId: data.payload.sectorId, periodo: periodoExtra })}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card p-5 mt-6">
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
            <Bar
              dataKey="montoExtra50"
              name="Extra 50%"
              fill="#f59e0b"
              onClick={(data) => setSectorSeleccionado({ sectorId: data.payload.sectorId, periodo: periodoExtra })}
            />
            <Bar
              dataKey="montoExtra100"
              name="Extra 100%"
              fill="#ef4444"
              onClick={(data) => setSectorSeleccionado({ sectorId: data.payload.sectorId, periodo: periodoExtra })}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {categoriaHoy && (
        <ModalListaEmpleados
          titulo={TITULOS_CATEGORIA[categoriaHoy]}
          empleados={detalleHoy?.[categoriaHoy]}
          onClose={() => setCategoriaHoy(null)}
        />
      )}
      {sectorSeleccionado && (
        <ModalDetalleSector
          titulo={detalleSector?.sector ?? sectores?.find((s) => s.id === sectorSeleccionado.sectorId)?.nombre ?? ""}
          detalle={detalleSector}
          onClose={() => setSectorSeleccionado(null)}
        />
      )}
    </div>
  );
}
