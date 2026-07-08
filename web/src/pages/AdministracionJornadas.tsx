import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";

interface Jornada {
  id: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  redondeoMinutos: number;
  toleranciaMinutos: number;
  activo: boolean;
}

export default function AdministracionJornadas() {
  const queryClient = useQueryClient();
  const { data: jornadas, isLoading } = useQuery({
    queryKey: ["jornadas"],
    queryFn: async () => (await api.get("/jornadas")).data as Jornada[],
  });

  const [form, setForm] = useState({
    nombre: "",
    horaInicio: "08:00",
    horaFin: "16:00",
    redondeoMinutos: "0",
    toleranciaMinutos: "0",
  });
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () =>
      api.post("/jornadas", {
        nombre: form.nombre,
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        redondeoMinutos: Number(form.redondeoMinutos),
        toleranciaMinutos: Number(form.toleranciaMinutos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jornadas"] });
      setForm({ nombre: "", horaInicio: "08:00", horaFin: "16:00", redondeoMinutos: "0", toleranciaMinutos: "0" });
    },
  });

  const eliminar = useMutation({
    mutationFn: async (id: string) => api.delete(`/jornadas/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jornadas"] });
      setError(null);
    },
    onError: (err: any) => setError(err?.response?.data?.error ?? "No se pudo eliminar la jornada"),
  });

  return (
    <div>
      <h1 className="page-header mb-6">Jornadas</h1>
      <div className="grid grid-cols-3 gap-6">
        <div className="card p-5 col-span-1">
          <h2 className="font-medium text-slate-700 mb-3">Nueva jornada</h2>
          <p className="text-xs text-slate-500 mb-3">
            Ej. Oficina 08:00 a 16:00, o turnos rotativos 04:00-12:00 / 12:00-20:00 / 20:00-04:00.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crear.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs text-slate-500 mb-1">Nombre</label>
              <input
                required
                placeholder="Oficina, Turno mañana..."
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Hora inicio</label>
                <input
                  type="time"
                  required
                  value={form.horaInicio}
                  onChange={(e) => setForm({ ...form, horaInicio: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Hora fin</label>
                <input
                  type="time"
                  required
                  value={form.horaFin}
                  onChange={(e) => setForm({ ...form, horaFin: e.target.value })}
                  className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Redondeo (minutos) <span className="text-slate-400">— ej. 60 = redondea 7.9hs a 8hs</span>
              </label>
              <input
                type="number"
                min={0}
                max={60}
                value={form.redondeoMinutos}
                onChange={(e) => setForm({ ...form, redondeoMinutos: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                Tolerancia llegada tarde (minutos) <span className="text-slate-400">— 0 = sin margen</span>
              </label>
              <input
                type="number"
                min={0}
                max={120}
                value={form.toleranciaMinutos}
                onChange={(e) => setForm({ ...form, toleranciaMinutos: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={crear.isPending}
              className="w-full bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50"
            >
              {crear.isPending ? "Guardando..." : "Agregar jornada"}
            </button>
          </form>
        </div>

        <div className="card p-5 col-span-2">
          <h2 className="font-medium text-slate-700 mb-3">Jornadas definidas</h2>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          {isLoading ? (
            <p className="text-slate-500 text-sm">Cargando...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2">Nombre</th>
                  <th className="pb-2">Horario</th>
                  <th className="pb-2">Redondeo</th>
                  <th className="pb-2">Tolerancia</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {jornadas?.map((j) => (
                  <tr key={j.id} className="border-b last:border-0">
                    <td className="py-2">{j.nombre}</td>
                    <td className="py-2">
                      {j.horaInicio} - {j.horaFin}
                    </td>
                    <td className="py-2">{j.redondeoMinutos > 0 ? `${j.redondeoMinutos} min` : "-"}</td>
                    <td className="py-2">{j.toleranciaMinutos > 0 ? `${j.toleranciaMinutos} min` : "-"}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => eliminar.mutate(j.id)} className="text-red-500 text-xs">
                        eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {jornadas?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-400">
                      Todavía no hay jornadas definidas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
