import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { api, errorMessage } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";

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
interface PreviewResult {
  token: string;
  sheetNames: string[];
  sheet: string;
  headers: string[];
  sample: Record<string, unknown>[];
  totalRows: number;
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
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showImport, setShowImport] = useState(false);

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

  // --- import de datos demográficos ---
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState({ legajo: "", fechaNacimiento: "", genero: "" });
  const [importResult, setImportResult] = useState<{ actualizados: number; errores: string[] } | null>(null);

  function guessMapping(headers: string[]) {
    const guess = (needle: string) => headers.find((h) => h.toLowerCase().includes(needle)) ?? "";
    return {
      legajo: guess("legajo"),
      fechaNacimiento: guess("nacimiento"),
      genero: guess("genero") || guess("género") || guess("sexo"),
    };
  }

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.post("/analitico/import-demografia/preview", fd)).data as PreviewResult;
    },
    onSuccess: (data) => {
      setPreview(data);
      setImportResult(null);
      setMapping(guessMapping(data.headers));
    },
  });

  const sheetMutation = useMutation({
    mutationFn: async (sheet: string) =>
      (await api.post("/analitico/import-demografia/preview-sheet", { token: preview!.token, sheet })).data as Omit<
        PreviewResult,
        "token"
      >,
    onSuccess: (data) => {
      setPreview((p) => (p ? { ...p, ...data } : p));
      setMapping(guessMapping(data.headers));
    },
  });

  function invalidarAnalitico() {
    queryClient.invalidateQueries({ queryKey: ["analitico-resumen"] });
    queryClient.invalidateQueries({ queryKey: ["analitico-por-genero"] });
    queryClient.invalidateQueries({ queryKey: ["analitico-por-antiguedad"] });
  }

  const confirmMutation = useMutation({
    mutationFn: async () =>
      (await api.post("/analitico/import-demografia/confirm", { token: preview!.token, sheet: preview!.sheet, mapping })).data as {
        actualizados: number;
        errores: string[];
      },
    onSuccess: (data) => {
      setImportResult(data);
      setPreview(null);
      invalidarAnalitico();
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-header">Analítico de personal</h1>
        {isAdmin && (
          <button
            onClick={() => setShowImport((v) => !v)}
            className="bg-white border border-slate-300 text-slate-700 text-sm px-4 py-2 rounded-md hover:bg-slate-50"
          >
            {showImport ? "Cancelar" : "Actualizar datos demográficos"}
          </button>
        )}
      </div>

      {showImport && (
        <div className="card p-5 mb-6">
          <h2 className="font-medium text-slate-700 mb-1">Importar fecha de nacimiento y género</h2>
          <p className="text-sm text-slate-500 mb-3">
            Subí la nómina con fecha de nacimiento y/o género (ej. planilla de RRHH). Se matchea por legajo contra los
            empleados existentes; no crea empleados nuevos ni toca el resto de sus datos.
          </p>
          <input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) previewMutation.mutate(file);
            }}
            className="text-sm mb-3"
          />
          {previewMutation.isPending && <p className="text-sm text-slate-500">Leyendo archivo...</p>}
          {previewMutation.isError && (
            <p className="text-sm text-red-600">{errorMessage(previewMutation.error, "No se pudo leer el archivo")}</p>
          )}

          {preview && (
            <div className="mt-3">
              {preview.sheetNames.length > 1 && (
                <div className="mb-3">
                  <label className="block text-xs text-slate-500 mb-1">Hoja del archivo</label>
                  <select
                    value={preview.sheet}
                    onChange={(e) => sheetMutation.mutate(e.target.value)}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  >
                    {preview.sheetNames.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-sm text-slate-500 mb-2">{preview.totalRows} filas encontradas. Mapeá las columnas:</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Legajo</label>
                  <select
                    value={mapping.legajo}
                    onChange={(e) => setMapping({ ...mapping, legajo: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  >
                    <option value="">-</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Fecha de nacimiento (opcional)</label>
                  <select
                    value={mapping.fechaNacimiento}
                    onChange={(e) => setMapping({ ...mapping, fechaNacimiento: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  >
                    <option value="">-</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Género (opcional)</label>
                  <select
                    value={mapping.genero}
                    onChange={(e) => setMapping({ ...mapping, genero: e.target.value })}
                    className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                  >
                    <option value="">-</option>
                    {preview.headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={!mapping.legajo || (!mapping.fechaNacimiento && !mapping.genero) || confirmMutation.isPending}
                className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50"
              >
                {confirmMutation.isPending ? "Importando..." : "Confirmar importación"}
              </button>
              {confirmMutation.isError && (
                <p className="text-sm text-red-600 mt-2">{errorMessage(confirmMutation.error, "No se pudo importar el archivo")}</p>
              )}
            </div>
          )}

          {importResult && (
            <div className="mt-4 text-sm">
              <p className="text-primary-dark">{importResult.actualizados} empleados actualizados.</p>
              {importResult.errores.length > 0 && (
                <details className="mt-2">
                  <summary className="text-amber-600 cursor-pointer">{importResult.errores.length} filas con observaciones</summary>
                  <ul className="mt-1 text-slate-500 max-h-40 overflow-auto">
                    {importResult.errores.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}

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
