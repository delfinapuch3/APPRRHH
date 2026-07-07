import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";

const ESTADOS = ["PENDIENTE", "TOMADO"] as const;

export default function Francos() {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<string>("");

  const { data: francos, isLoading } = useQuery({
    queryKey: ["francos-list", estado],
    queryFn: async () => (await api.get(`/francos${estado ? `?estado=${estado}` : ""}`)).data as any[],
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, nuevoEstado }: { id: string; nuevoEstado: string }) =>
      api.put(`/francos/${id}`, { estado: nuevoEstado, ...(nuevoEstado === "TOMADO" ? { fechaTomado: new Date().toISOString() } : {}) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["francos-list"] }),
  });

  async function exportar() {
    const res = await api.get(`/francos/export.xlsx${estado ? `?estado=${estado}` : ""}`, { responseType: "blob" });
    const url = URL.createObjectURL(res.data as Blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "francos.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Francos compensatorios</h1>
        <button onClick={exportar} className="text-sm text-primary hover:underline">
          Exportar
        </button>
      </div>

      <div className="mb-4 flex gap-2">
        {["", ...ESTADOS].map((e) => (
          <button
            key={e}
            onClick={() => setEstado(e)}
            className={`px-3 py-1.5 rounded-md text-sm ${estado === e ? "bg-primary text-white" : "bg-white text-slate-600"}`}
          >
            {e || "Todos"}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow-sm p-5">
        {isLoading ? (
          <p className="text-slate-500 text-sm">Cargando...</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 border-b">
                <th className="pb-2">Legajo</th>
                <th className="pb-2">Empleado</th>
                <th className="pb-2">Generado el</th>
                <th className="pb-2">Horas</th>
                <th className="pb-2">Estado</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {francos?.map((f) => (
                <tr key={f.id} className="border-b last:border-0">
                  <td className="py-2">{f.employee.legajo}</td>
                  <td className="py-2">
                    {f.employee.apellido}, {f.employee.nombre}
                  </td>
                  <td className="py-2">{new Date(f.fechaGenerado).toLocaleDateString("es-AR", { timeZone: "UTC" })}</td>
                  <td className="py-2">{f.horas}</td>
                  <td className="py-2">{f.estado}</td>
                  <td className="py-2 text-right">
                    {f.estado === "PENDIENTE" && (
                      <button
                        onClick={() => actualizar.mutate({ id: f.id, nuevoEstado: "TOMADO" })}
                        className="text-slate-700 underline text-sm"
                      >
                        Marcar tomado
                      </button>
                    )}
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
