import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";

interface Feriado {
  id: string;
  fecha: string;
  nombre: string;
}

export default function AdministracionFeriados() {
  const queryClient = useQueryClient();
  const { data: feriados } = useQuery({
    queryKey: ["feriados"],
    queryFn: async () => (await api.get("/configuracion/feriados")).data as Feriado[],
  });

  const [nuevoFeriado, setNuevoFeriado] = useState({ fecha: "", nombre: "" });
  const crearFeriado = useMutation({
    mutationFn: async () => api.post("/configuracion/feriados", nuevoFeriado),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feriados"] });
      setNuevoFeriado({ fecha: "", nombre: "" });
    },
  });
  const borrarFeriado = useMutation({
    mutationFn: async (id: string) => api.delete(`/configuracion/feriados/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["feriados"] }),
  });

  return (
    <div>
      <h1 className="page-header mb-6">Feriados</h1>
      <div className="card p-5 max-w-xl">
        <ul className="text-sm mb-3 space-y-1 max-h-64 overflow-auto">
          {feriados?.map((f) => (
            <li key={f.id} className="flex justify-between items-center text-slate-600">
              <span>
                {new Date(f.fecha).toLocaleDateString("es-AR", { timeZone: "UTC" })} - {f.nombre}
              </span>
              <button onClick={() => borrarFeriado.mutate(f.id)} className="text-red-500 text-xs">
                eliminar
              </button>
            </li>
          ))}
        </ul>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            crearFeriado.mutate();
          }}
          className="flex gap-2"
        >
          <input
            type="date"
            required
            value={nuevoFeriado.fecha}
            onChange={(e) => setNuevoFeriado({ ...nuevoFeriado, fecha: e.target.value })}
            className="border border-slate-300 rounded-md px-2 py-1.5 text-sm"
          />
          <input
            required
            placeholder="Nombre"
            value={nuevoFeriado.nombre}
            onChange={(e) => setNuevoFeriado({ ...nuevoFeriado, nombre: e.target.value })}
            className="flex-1 border border-slate-300 rounded-md px-2 py-1.5 text-sm"
          />
          <button type="submit" className="bg-primary text-white text-sm px-3 py-1.5 rounded-md">
            Agregar
          </button>
        </form>
      </div>
    </div>
  );
}
