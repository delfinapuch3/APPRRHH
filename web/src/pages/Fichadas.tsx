import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../api/client.js";

interface Empleado {
  id: string;
  legajo: string;
  nombre: string;
  apellido: string;
}

interface PreviewResult {
  token: string;
  sheetNames: string[];
  sheet: string;
  headers: string[];
  sample: Record<string, unknown>[];
  totalRows: number;
}

export default function Fichadas() {
  const queryClient = useQueryClient();
  const { data: empleados } = useQuery({
    queryKey: ["empleados"],
    queryFn: async () => (await api.get("/empleados")).data as Empleado[],
  });
  const { data: fichadas } = useQuery({
    queryKey: ["fichadas-recientes"],
    queryFn: async () => (await api.get("/fichadas")).data as any[],
  });

  // --- import ---
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [mapping, setMapping] = useState({
    legajo: "",
    fecha: "",
    modo: "separado" as "separado" | "combinado",
    horaEntrada: "",
    horaSalida: "",
    marcaciones: "",
  });
  const [importResult, setImportResult] = useState<{ insertados: number; errores: string[] } | null>(null);

  function guessMapping(headers: string[]) {
    const guess = (needle: string) => headers.find((h) => h.toLowerCase().includes(needle)) ?? "";
    const marcaciones = guess("marcacion");
    return {
      legajo: guess("legajo"),
      fecha: guess("fecha"),
      modo: (marcaciones ? "combinado" : "separado") as "separado" | "combinado",
      horaEntrada: marcaciones ? "" : guess("entrada"),
      horaSalida: marcaciones ? "" : guess("salida"),
      marcaciones,
    };
  }

  const previewMutation = useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return (await api.post("/fichadas/import/preview", fd)).data as PreviewResult;
    },
    onSuccess: (data) => {
      setPreview(data);
      setImportResult(null);
      setMapping(guessMapping(data.headers));
    },
  });

  const sheetMutation = useMutation({
    mutationFn: async (sheet: string) =>
      (await api.post("/fichadas/import/preview-sheet", { token: preview!.token, sheet })).data as Omit<PreviewResult, "token">,
    onSuccess: (data) => {
      setPreview((p) => (p ? { ...p, ...data } : p));
      setMapping(guessMapping(data.headers));
    },
  });

  const confirmMutation = useMutation({
    mutationFn: async () =>
      (await api.post("/fichadas/import/confirm", { token: preview!.token, sheet: preview!.sheet, mapping })).data as {
        insertados: number;
        errores: string[];
      },
    onSuccess: (data) => {
      setImportResult(data);
      setPreview(null);
      queryClient.invalidateQueries({ queryKey: ["fichadas-recientes"] });
    },
  });

  // --- manual entry ---
  const [form, setForm] = useState({ employeeId: "", fecha: "", horaEntrada: "", horaSalida: "" });
  const crearManual = useMutation({
    mutationFn: async () =>
      api.post("/fichadas", {
        employeeId: form.employeeId,
        fecha: form.fecha,
        horaEntrada: `${form.fecha}T${form.horaEntrada}:00`,
        horaSalida: form.horaSalida ? `${form.fecha}T${form.horaSalida}:00` : null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fichadas-recientes"] });
      setForm({ employeeId: "", fecha: "", horaEntrada: "", horaSalida: "" });
    },
  });

  return (
    <div>
      <h1 className="page-header mb-6">Marcaciones</h1>

      <div className="grid grid-cols-2 gap-6 mb-6">
        <div className="card p-5">
          <h2 className="font-medium text-slate-700 mb-3">Importar archivo del reloj</h2>
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

              <div className="mb-3">
                <label className="block text-xs text-slate-500 mb-1">Formato de horarios</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMapping({ ...mapping, modo: "separado" })}
                    className={`flex-1 py-1.5 rounded-md text-sm ${mapping.modo === "separado" ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    Entrada y salida en columnas separadas
                  </button>
                  <button
                    type="button"
                    onClick={() => setMapping({ ...mapping, modo: "combinado" })}
                    className={`flex-1 py-1.5 rounded-md text-sm ${mapping.modo === "combinado" ? "bg-primary text-white" : "bg-slate-100 text-slate-600"}`}
                  >
                    Una columna combinada (ej: "E 08:07 - S 15:56")
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
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
                  <label className="block text-xs text-slate-500 mb-1">Fecha</label>
                  <select
                    value={mapping.fecha}
                    onChange={(e) => setMapping({ ...mapping, fecha: e.target.value })}
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

                {mapping.modo === "combinado" ? (
                  <div className="col-span-2">
                    <label className="block text-xs text-slate-500 mb-1">Marcaciones (entrada y salida juntas)</label>
                    <select
                      value={mapping.marcaciones}
                      onChange={(e) => setMapping({ ...mapping, marcaciones: e.target.value })}
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
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">Hora entrada</label>
                      <select
                        value={mapping.horaEntrada}
                        onChange={(e) => setMapping({ ...mapping, horaEntrada: e.target.value })}
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
                      <label className="block text-xs text-slate-500 mb-1">Hora salida</label>
                      <select
                        value={mapping.horaSalida}
                        onChange={(e) => setMapping({ ...mapping, horaSalida: e.target.value })}
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
                  </>
                )}
              </div>

              {preview.sample[0] && mapping.modo === "combinado" && mapping.marcaciones && (
                <p className="text-xs text-slate-400 mb-3">
                  Ejemplo de la primera fila: "{String(preview.sample[0][mapping.marcaciones])}"
                </p>
              )}

              <button
                onClick={() => confirmMutation.mutate()}
                disabled={
                  !mapping.legajo ||
                  !mapping.fecha ||
                  (mapping.modo === "combinado" ? !mapping.marcaciones : !mapping.horaEntrada) ||
                  confirmMutation.isPending
                }
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
              <p className="text-primary-dark">{importResult.insertados} fichadas importadas.</p>
              {importResult.errores.length > 0 && (
                <details className="mt-2">
                  <summary className="text-red-600 cursor-pointer">{importResult.errores.length} filas con error</summary>
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

        <div className="card p-5">
          <h2 className="font-medium text-slate-700 mb-3">Carga manual</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crearManual.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs text-slate-500 mb-1">Empleado</label>
              <select
                required
                value={form.employeeId}
                onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              >
                <option value="">Seleccionar...</option>
                {empleados?.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.legajo} - {e.apellido}, {e.nombre}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Fecha</label>
                <input
                  type="date"
                  required
                  value={form.fecha}
                  onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Entrada</label>
                <input
                  type="time"
                  required
                  value={form.horaEntrada}
                  onChange={(e) => setForm({ ...form, horaEntrada: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Salida</label>
                <input
                  type="time"
                  value={form.horaSalida}
                  onChange={(e) => setForm({ ...form, horaSalida: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <button type="submit" className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark">
              Guardar fichada
            </button>
          </form>
        </div>
      </div>

      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-medium text-slate-700">Últimas fichadas</h2>
          <button
            onClick={async () => {
              const res = await api.get("/fichadas/export.xlsx", { responseType: "blob" });
              const url = URL.createObjectURL(res.data as Blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "fichadas.xlsx";
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="text-sm text-primary hover:underline"
          >
            Exportar
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b">
              <th className="pb-2">Legajo</th>
              <th className="pb-2">Empleado</th>
              <th className="pb-2">Fecha</th>
              <th className="pb-2">Entrada</th>
              <th className="pb-2">Salida</th>
              <th className="pb-2">Origen</th>
            </tr>
          </thead>
          <tbody>
            {fichadas?.slice(0, 50).map((f) => (
              <tr key={f.id} className="border-b last:border-0">
                <td className="py-2">{f.employee.legajo}</td>
                <td className="py-2">
                  {f.employee.apellido}, {f.employee.nombre}
                </td>
                <td className="py-2">{new Date(f.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                <td className="py-2">{new Date(f.horaEntrada).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false })}</td>
                <td className="py-2">
                  {f.horaSalida ? new Date(f.horaSalida).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false }) : "-"}
                </td>
                <td className="py-2">{f.origen}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
