import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  role: "ADMIN" | "ENCARGADO";
  activo: boolean;
}

export default function AdministracionUsuarios() {
  const queryClient = useQueryClient();
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => (await api.get("/usuarios")).data as Usuario[],
  });

  const [form, setForm] = useState({ nombre: "", apellido: "", email: "", password: "", role: "ENCARGADO" });
  const crear = useMutation({
    mutationFn: async () => api.post("/usuarios", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      setForm({ nombre: "", apellido: "", email: "", password: "", role: "ENCARGADO" });
    },
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; activo?: boolean; role?: string }) => api.put(`/usuarios/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  return (
    <div>
      <h1 className="page-header mb-6">Usuarios</h1>
      <div className="grid grid-cols-3 gap-6">
        <div className="card p-5 col-span-1">
          <h2 className="font-medium text-slate-700 mb-3">Nuevo usuario</h2>
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
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Apellido</label>
              <input
                required
                value={form.apellido}
                onChange={(e) => setForm({ ...form, apellido: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Rol</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              >
                <option value="ENCARGADO">Encargado de sector</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Email de acceso</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full border border-slate-300 rounded-md px-2 py-1.5 text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={crear.isPending}
              className="w-full bg-primary text-white text-sm px-4 py-2 rounded-md hover:bg-primary-dark disabled:opacity-50"
            >
              {crear.isPending ? "Creando..." : "Crear usuario"}
            </button>
            {crear.isError && <p className="text-sm text-red-600">No se pudo crear el usuario (¿email repetido?)</p>}
          </form>
        </div>

        <div className="card p-5 col-span-2">
          <h2 className="font-medium text-slate-700 mb-3">Usuarios del sistema</h2>
          {isLoading ? (
            <p className="text-slate-500 text-sm">Cargando...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b">
                  <th className="pb-2">Nombre</th>
                  <th className="pb-2">Email</th>
                  <th className="pb-2">Rol</th>
                  <th className="pb-2">Estado</th>
                  <th className="pb-2"></th>
                </tr>
              </thead>
              <tbody>
                {usuarios?.map((u) => (
                  <tr key={u.id} className={`border-b last:border-0 ${!u.activo ? "opacity-50" : ""}`}>
                    <td className="py-2">{u.apellido ? `${u.apellido}, ${u.nombre}` : u.nombre}</td>
                    <td className="py-2">{u.email}</td>
                    <td className="py-2">
                      <select
                        value={u.role}
                        onChange={(e) => actualizar.mutate({ id: u.id, role: e.target.value })}
                        className="border border-slate-300 rounded-md px-2 py-1 text-xs"
                      >
                        <option value="ENCARGADO">Encargado</option>
                        <option value="ADMIN">Administrador</option>
                      </select>
                    </td>
                    <td className="py-2">{u.activo ? "Activo" : "Inactivo"}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => actualizar.mutate({ id: u.id, activo: !u.activo })} className="text-slate-700 underline text-sm">
                        {u.activo ? "Dar de baja" : "Reactivar"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
