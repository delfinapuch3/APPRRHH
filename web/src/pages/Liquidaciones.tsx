import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";

interface Empleado {
  id: string;
  legajo: string;
  nombre: string;
  apellido: string;
}

function firstOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function Liquidaciones() {
  const queryClient = useQueryClient();
  const { data: empleados } = useQuery({
    queryKey: ["empleados"],
    queryFn: async () => (await api.get("/empleados")).data as Empleado[],
  });
  const { data: liquidaciones, isLoading } = useQuery({
    queryKey: ["liquidaciones"],
    queryFn: async () => (await api.get("/liquidaciones")).data as any[],
  });

  const [form, setForm] = useState({
    employeeId: "",
    tipo: "QUINCENAL",
    fechaDesde: firstOfMonth(),
    fechaHasta: today(),
  });

  const [avisoSinValidar, setAvisoSinValidar] = useState<string | null>(null);
  const generar = useMutation({
    mutationFn: async () => (await api.post("/liquidaciones/generar", form)).data,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["liquidaciones"] });
      if (data.diasSinValidarCount > 0) {
        setAvisoSinValidar(
          `Ojo: quedaron ${data.horasExtra50SinValidar.toFixed(1)}hs extra 50% y ${data.horasExtra100SinValidar.toFixed(
            1
          )}hs extra 100% sin validar en ${data.diasSinValidarCount} día(s) — no se incluyeron en esta liquidación. Validalas desde la ficha del empleado y generá la liquidación de nuevo si corresponde.`
        );
      } else {
        setAvisoSinValidar(null);
      }
    },
  });

  async function exportar(id: string) {
    const res = await api.get(`/liquidaciones/${id}/export.xlsx`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `liquidacion-${id}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const [planilla, setPlanilla] = useState({ fechaDesde: firstOfMonth(), fechaHasta: today() });
  const [exportandoPlanilla, setExportandoPlanilla] = useState(false);
  async function exportarPlanillaGeneral() {
    setExportandoPlanilla(true);
    try {
      const res = await api.get(
        `/liquidaciones/export-planilla.xlsx?desde=${planilla.fechaDesde}&hasta=${planilla.fechaHasta}`,
        { responseType: "blob" }
      );
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `planilla-general-${planilla.fechaDesde}-a-${planilla.fechaHasta}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExportandoPlanilla(false);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Liquidaciones</h1>

      <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
        <h2 className="font-medium text-slate-700 mb-3">Generar liquidación</h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            generar.mutate();
          }}
          className="flex gap-3 items-end flex-wrap"
        >
          <div>
            <label className="block text-xs text-slate-500 mb-1">Empleado</label>
            <select
              required
              value={form.employeeId}
              onChange={(e) => setForm({ ...form, employeeId: e.target.value })}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm min-w-[200px]"
            >
              <option value="">Seleccionar...</option>
              {empleados?.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.legajo} - {e.apellido}, {e.nombre}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            >
              <option value="QUINCENAL">Quincenal</option>
              <option value="MENSUAL">Mensual</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Desde</label>
            <input
              type="date"
              value={form.fechaDesde}
              onChange={(e) => setForm({ ...form, fechaDesde: e.target.value })}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Hasta</label>
            <input
              type="date"
              value={form.fechaHasta}
              onChange={(e) => setForm({ ...form, fechaHasta: e.target.value })}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={generar.isPending}
            className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50"
          >
            {generar.isPending ? "Generando..." : "Generar"}
          </button>
        </form>
        {generar.isError && <p className="text-red-600 text-sm mt-2">No se pudo generar la liquidación</p>}
        {avisoSinValidar && <p className="text-amber-600 text-sm mt-2">{avisoSinValidar}</p>}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-5 mb-6">
        <h2 className="font-medium text-slate-700 mb-3">Planilla general (todo el personal)</h2>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Desde</label>
            <input
              type="date"
              value={planilla.fechaDesde}
              onChange={(e) => setPlanilla({ ...planilla, fechaDesde: e.target.value })}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Hasta</label>
            <input
              type="date"
              value={planilla.fechaHasta}
              onChange={(e) => setPlanilla({ ...planilla, fechaHasta: e.target.value })}
              className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={exportarPlanillaGeneral}
            disabled={exportandoPlanilla}
            className="bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50"
          >
            {exportandoPlanilla ? "Generando..." : "Exportar planilla general"}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-5">
        {isLoading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Empleado</th>
                <th className="pb-2">Tipo</th>
                <th className="pb-2">Período</th>
                <th className="pb-2">Hs. normales</th>
                <th className="pb-2">Hs. extra 50%</th>
                <th className="pb-2">Hs. extra 100%</th>
                <th className="pb-2">Total</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {liquidaciones?.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2">
                    {l.employee.apellido}, {l.employee.nombre}
                  </td>
                  <td className="py-2">{l.tipo}</td>
                  <td className="py-2">
                    {new Date(l.fechaDesde).toLocaleDateString("es-AR", { timeZone: "UTC" })} -{" "}
                    {new Date(l.fechaHasta).toLocaleDateString("es-AR", { timeZone: "UTC" })}
                  </td>
                  <td className="py-2">{l.horasNormales.toFixed(1)}</td>
                  <td className="py-2">{l.horasExtra50.toFixed(1)}</td>
                  <td className="py-2">{l.horasExtra100.toFixed(1)}</td>
                  <td className="py-2 font-medium">${l.totalBruto.toLocaleString("es-AR", { maximumFractionDigits: 0 })}</td>
                  <td className="py-2">{l.estado}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => exportar(l.id)} className="text-slate-700 underline text-sm">
                      Exportar
                    </button>
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
