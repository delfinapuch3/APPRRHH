import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";

interface Empleado {
  id: string;
  legajo: string;
  nombre: string;
  apellido: string;
  sindicato: string | null;
  fechaIngreso: string;
  valorHoraNormal: number;
  activo: boolean;
  obra: { id: string; nombre: string } | null;
}

interface Obra {
  id: string;
  nombre: string;
}

interface PreviewResult {
  token: string;
  headers: string[];
  sample: Record<string, unknown>[];
  totalRows: number;
}

const MAPPING_FIELDS = [
  ["legajo", "Legajo"],
  ["nombre", "Nombre"],
  ["apellido", "Apellido"],
  ["sindicato", "Sindicato (opcional)"],
  ["valorHoraNormal", "Valor hora normal"],
  ["fechaIngreso", "Fecha de ingreso"],
  ["obra", "Obra (opcional)"],
] as const;

export default function Empleados() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const { data: empleados, isLoading } = useQuery({
    queryKey: ["empleados"],
    queryFn: async () => (await api.get("/empleados")).data as Empleado[],
  });
  const { data: obras } = useQuery({
    queryKey: ["obras"],
    queryFn: async () => (await api.get("/obras")).data as Obra[],
    enabled: isAdmin,
  });

  const [form, setForm] = useState({
    legajo: "",
    nombre: "",
    apellido: "",
    sindicato: "",
    fechaIngreso: "",
    valorHoraNormal: "",
    obraId: "",
  });

  const crear = useMutation({
    mutationFn: async () =>
      api.post("/empleados", {
        ...form,
        sindicato: form.sindicato || null,
        valorHoraNormal: Number(form.valorHoraNormal),
        obraId: form.obraId || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["empleados"] });
      setShowForm(false);
      setForm({ legajo: "", nombre: "", apellido: "", sindicato: "", fechaIngreso: "", valorHoraNormal: "", obraId: "" });
    },
  });

  // --- import masivo ---
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState({
    legajo: "",
    nombre: "",
    apellido: "",
    sindicato: "",
    valorHoraNormal: "",
    fechaIngreso: "",
    obra: "",
  });
  const [importResult, setImportResult] = useState<{ creados: number; actualizados: number; errores: string[] } | null>(null);

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.post("/empleados/import/preview", fd, { headers: { "Content-Type": "multipart/form-data" } })).data as PreviewResult;
    },
    onSuccess: (data) => {
      setPreview(data);
      setImportResult(null);
      const guess = (needle: string) => data.headers.find((h) => h.toLowerCase().includes(needle)) ?? "";
      setMapping({
        legajo: guess("legajo"),
        nombre: guess("nombre"),
        apellido: guess("apellido"),
        sindicato: guess("sindicato"),
        valorHoraNormal: guess("hora"),
        fechaIngreso: guess("ingreso"),
        obra: guess("obra"),
      });
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () =>
      (await api.post("/empleados/import/confirm", { token: preview!.token, mapping })).data as {
        creados: number;
        actualizados: number;
        errores: string[];
      },
    onSuccess: (data) => {
      setImportResult(data);
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["empleados"] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Empleados</h1>
        {isAdmin && (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setShowImport((v) => !v);
                setShowForm(false);
              }}
              className="bg-white border border-slate-300 text-slate-700 text-sm px-4 py-2 rounded-md hover:bg-slate-50"
            >
              {showImport ? "Cancelar" : "Importar planilla"}
            </button>
            <button
              onClick={() => {
                setShowForm((v) => !v);
                setShowImport(false);
              }}
              className="bg-slate-900 text-white text-sm px-4 py-2 rounded-md hover:bg-slate-800"
            >
              {showForm ? "Cancelar" : "+ Nuevo empleado"}
            </button>
          </div>
        )}
      </div>

      {showImport && (
        <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
          <h2 className="font-medium text-slate-700 mb-1">Importar planilla de empleados</h2>
          <p className="text-sm text-slate-500 mb-3">
            Subí un Excel/CSV con una fila por empleado. Columnas necesarias: Legajo, Nombre, Apellido y Valor hora
            normal. Sindicato y Obra son opcionales. Si el legajo ya existe, se actualizan sus datos.
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
          {previewMutation.isError && <p className="text-sm text-red-600">No se pudo leer el archivo</p>}

          {preview && (
            <div className="mt-3">
              <p className="text-sm text-slate-500 mb-2">{preview.totalRows} filas encontradas. Mapeá las columnas:</p>
              <div className="grid grid-cols-3 gap-3 mb-3">
                {MAPPING_FIELDS.map(([field, label]) => (
                  <div key={field}>
                    <label className="block text-xs text-slate-500 mb-1">{label}</label>
                    <select
                      value={mapping[field]}
                      onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })}
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
                ))}
              </div>
              <button
                onClick={() => confirmMutation.mutate()}
                disabled={
                  !mapping.legajo ||
                  !mapping.nombre ||
                  !mapping.apellido ||
                  !mapping.valorHoraNormal ||
                  !mapping.fechaIngreso ||
                  confirmMutation.isPending
                }
                className="bg-slate-900 text-white text-sm px-4 py-2 rounded-md hover:bg-slate-800 disabled:opacity-50"
              >
                {confirmMutation.isPending ? "Importando..." : "Confirmar importación"}
              </button>
            </div>
          )}

          {importResult && (
            <div className="mt-4 text-sm">
              <p className="text-emerald-700">
                {importResult.creados} empleados creados, {importResult.actualizados} actualizados.
              </p>
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

      {showForm && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            crear.mutate();
          }}
          className="bg-white rounded-lg shadow-sm p-5 mb-6 grid grid-cols-3 gap-4"
        >
          <div>
            <label className="block text-sm text-slate-600 mb-1">Legajo</label>
            <input
              required
              value={form.legajo}
              onChange={(e) => setForm({ ...form, legajo: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Nombre</label>
            <input
              required
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Apellido</label>
            <input
              required
              value={form.apellido}
              onChange={(e) => setForm({ ...form, apellido: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Sindicato</label>
            <input
              value={form.sindicato}
              onChange={(e) => setForm({ ...form, sindicato: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Fecha de ingreso</label>
            <input
              type="date"
              required
              value={form.fechaIngreso}
              onChange={(e) => setForm({ ...form, fechaIngreso: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Valor hora normal ($)</label>
            <input
              type="number"
              step="0.01"
              required
              value={form.valorHoraNormal}
              onChange={(e) => setForm({ ...form, valorHoraNormal: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-slate-600 mb-1">Obra</label>
            <select
              value={form.obraId}
              onChange={(e) => setForm({ ...form, obraId: e.target.value })}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="">Sin asignar</option>
              {obras?.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-3">
            <button type="submit" className="bg-slate-900 text-white text-sm px-4 py-2 rounded-md hover:bg-slate-800">
              Guardar
            </button>
          </div>
        </form>
      )}

      <div className="bg-white rounded-lg shadow-sm p-5">
        {isLoading ? (
          <p className="text-slate-500">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Legajo</th>
                <th className="pb-2">Nombre</th>
                <th className="pb-2">Sindicato</th>
                <th className="pb-2">Obra</th>
                <th className="pb-2">Valor hora</th>
                <th className="pb-2">Ingreso</th>
              </tr>
            </thead>
            <tbody>
              {empleados?.map((e) => (
                <tr key={e.id} className="border-b last:border-0">
                  <td className="py-2">{e.legajo}</td>
                  <td className="py-2">
                    <Link to={`/empleados/${e.id}`} className="text-slate-700 hover:underline">
                      {e.apellido}, {e.nombre}
                    </Link>
                  </td>
                  <td className="py-2">{e.sindicato ?? "-"}</td>
                  <td className="py-2">{e.obra?.nombre ?? "-"}</td>
                  <td className="py-2">${e.valorHoraNormal.toLocaleString("es-AR")}</td>
                  <td className="py-2">{new Date(e.fechaIngreso).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
