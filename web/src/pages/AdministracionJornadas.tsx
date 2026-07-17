import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { InfoTip } from "../components/InfoTip.js";
import { useConfirm } from "../components/ConfirmProvider.js";

interface Jornada {
  id: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  toleranciaMinutos: number;
  activo: boolean;
}

export default function AdministracionJornadas() {
  const queryClient = useQueryClient();
  const confirmar = useConfirm();
  const { data: jornadas, isLoading } = useQuery({
    queryKey: ["jornadas"],
    queryFn: async () => (await api.get("/jornadas")).data as Jornada[],
  });

  const [form, setForm] = useState({
    nombre: "",
    horaInicio: "08:00",
    horaFin: "16:00",
    toleranciaMinutos: "15",
  });
  const [error, setError] = useState<string | null>(null);

  const crear = useMutation({
    mutationFn: async () =>
      api.post("/jornadas", {
        nombre: form.nombre,
        horaInicio: form.horaInicio,
        horaFin: form.horaFin,
        toleranciaMinutos: Number(form.toleranciaMinutos),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jornadas"] });
      setForm({ nombre: "", horaInicio: "08:00", horaFin: "16:00", toleranciaMinutos: "15" });
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
      <h1 className="page-header mb-6 flex items-center gap-2">
        Turnos
        <InfoTip texto="Los horarios de trabajo (ej. 08:00 a 16:00) con su tolerancia de minutos. El sistema los usa para detectar entradas tarde y salidas tempranas al procesar las marcaciones." />
      </h1>
      <div className="grid grid-cols-3 gap-6">
        <div className="card p-5 col-span-1">
          <h2 className="font-medium text-slate-700 mb-3">Nuevo turno</h2>
          <p className="text-xs text-slate-500 mb-3">
            Ej. Oficina 08:00 a 16:00, o turnos rotativos Mañana 04:00-12:00 / Tarde 12:00-20:00 / Noche 20:00-04:00.
            No hace falta asignarlos a cada empleado: todos los días, el sistema detecta automáticamente cuál de
            estos turnos activos es el más parecido a la marcación real.
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
                Margen (minutos){" "}
                <span className="text-slate-400">
                  — un desvío de hasta este margen (para llegar o para salir) se redondea a la hora exacta del
                  turno; pasado este margen, la entrada se marca como tardanza y la salida como hora extra a
                  validar
                </span>
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
              {crear.isPending ? "Guardando..." : "Agregar turno"}
            </button>
          </form>
        </div>

        <div className="card p-5 col-span-2">
          <h2 className="font-medium text-slate-700 mb-3">Turnos definidos</h2>
          {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
          {isLoading ? (
            <p className="text-slate-500 text-sm">Cargando...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2">Nombre</th>
                  <th className="pb-2">Horario</th>
                  <th className="pb-2">Margen</th>
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
                    <td className="py-2">{j.toleranciaMinutos} min</td>
                    <td className="py-2 text-right">
                      <button
                        onClick={async () => {
                          const ok = await confirmar({
                            titulo: "Eliminar turno",
                            mensaje: `¿Eliminar el turno "${j.nombre}" (${j.horaInicio} - ${j.horaFin})? Esta acción no se puede deshacer.`,
                            textoConfirmar: "Eliminar",
                            peligro: true,
                          });
                          if (ok) eliminar.mutate(j.id);
                        }}
                        className="text-red-500 text-xs"
                      >
                        eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {jornadas?.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-400">
                      Todavía no hay turnos definidos
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
