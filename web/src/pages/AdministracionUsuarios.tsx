import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, errorMessage } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";
import { InfoTip } from "../components/InfoTip.js";
import { useConfirm } from "../components/ConfirmProvider.js";

interface Sector {
  id: string;
  nombre: string;
  activo?: boolean;
}

interface Usuario {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  role: "ADMIN" | "ENCARGADO";
  activo: boolean;
  sectores: Sector[];
}

interface EdicionForm {
  email: string;
  nombre: string;
  apellido: string;
  role: "ADMIN" | "ENCARGADO";
  activo: boolean;
  password: string;
  sectorIds: string[];
}

export default function AdministracionUsuarios() {
  const queryClient = useQueryClient();
  const { user: actual } = useAuth();
  const confirmar = useConfirm();

  const { data: usuarios, isLoading } = useQuery({
    queryKey: ["usuarios"],
    queryFn: async () => (await api.get("/usuarios")).data as Usuario[],
  });
  const { data: sectores } = useQuery({
    queryKey: ["sectores"],
    queryFn: async () => (await api.get("/sectores")).data as Sector[],
  });

  // --- crear ---
  const [form, setForm] = useState({
    nombre: "",
    apellido: "",
    email: "",
    password: "",
    role: "ENCARGADO" as "ADMIN" | "ENCARGADO",
    sectorIds: [] as string[],
  });
  const crear = useMutation({
    mutationFn: async () => api.post("/usuarios", form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      setForm({ nombre: "", apellido: "", email: "", password: "", role: "ENCARGADO", sectorIds: [] });
    },
  });

  // --- toggles rápidos (rol / activo) desde la tabla ---
  const actualizar = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; activo?: boolean; role?: string }) => api.put(`/usuarios/${id}`, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  // --- borrar usuario ---
  const eliminar = useMutation({
    mutationFn: async (id: string) => api.delete(`/usuarios/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
    onError: (err) => alert(errorMessage(err, "No se pudo eliminar el usuario")),
  });

  async function confirmarEliminar(u: Usuario) {
    const nombre = u.apellido ? `${u.apellido}, ${u.nombre}` : u.nombre;
    const ok = await confirmar({
      titulo: "Eliminar usuario",
      mensaje: `¿Eliminar definitivamente a ${nombre} (${u.email})? Esta acción no se puede deshacer. Si el usuario tiene registros asociados no se podrá borrar; en ese caso, dalo de baja.`,
      textoConfirmar: "Eliminar",
      peligro: true,
    });
    if (ok) eliminar.mutate(u.id);
  }

  async function confirmarBaja(u: Usuario) {
    const nombre = u.apellido ? `${u.apellido}, ${u.nombre}` : u.nombre;
    if (u.activo) {
      const ok = await confirmar({
        titulo: "Dar de baja",
        mensaje: `${nombre} ya no va a poder iniciar sesión. Se conserva su historial y podés reactivarlo después. ¿Confirmás?`,
        textoConfirmar: "Dar de baja",
      });
      if (ok) actualizar.mutate({ id: u.id, activo: false });
    } else {
      actualizar.mutate({ id: u.id, activo: true });
    }
  }

  // --- edición completa (modal) ---
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [edit, setEdit] = useState<EdicionForm | null>(null);

  function abrirEdicion(u: Usuario) {
    setEditando(u);
    setEdit({
      email: u.email,
      nombre: u.nombre,
      apellido: u.apellido,
      role: u.role,
      activo: u.activo,
      password: "",
      sectorIds: u.sectores.map((s) => s.id),
    });
  }

  const guardarEdicion = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        email: edit!.email,
        nombre: edit!.nombre,
        apellido: edit!.apellido,
        role: edit!.role,
        activo: edit!.activo,
        sectorIds: edit!.sectorIds,
      };
      if (edit!.password.trim()) payload.password = edit!.password;
      return api.put(`/usuarios/${editando!.id}`, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      setEditando(null);
      setEdit(null);
    },
  });

  function toggleSector(list: string[], id: string): string[] {
    return list.includes(id) ? list.filter((s) => s !== id) : [...list, id];
  }

  return (
    <div>
      <h1 className="page-header mb-6 flex items-center gap-2">
        Usuarios
        <InfoTip texto="Personas que pueden entrar al sistema. Acá creás sus accesos, definís el rol (qué pueden hacer), les reseteás la contraseña y los das de alta o baja. No confundir con los empleados/operarios." />
      </h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Nuevo usuario */}
        <div className="card p-5 lg:col-span-1">
          <h2 className="section-title mb-3">Nuevo usuario</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              crear.mutate();
            }}
            className="space-y-3"
          >
            <div>
              <label className="section-title block mb-1.5">Nombre</label>
              <input required value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className="input" />
            </div>
            <div>
              <label className="section-title block mb-1.5">Apellido</label>
              <input required value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} className="input" />
            </div>
            <div>
              <label className="section-title mb-1.5 flex items-center gap-1">
                Rol
                <InfoTip texto="Administrador: acceso total (usuarios, liquidaciones, configuración, todos los sectores). Encargado de sector: solo ve y gestiona los sectores que le asignes abajo." />
              </label>
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as "ADMIN" | "ENCARGADO" })} className="input">
                <option value="ENCARGADO">Encargado de sector</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div>
              <label className="section-title block mb-1.5">Email de acceso</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="input" />
            </div>
            <div>
              <label className="section-title block mb-1.5">Contraseña</label>
              <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="input" />
            </div>
            {form.role === "ENCARGADO" && sectores && sectores.length > 0 && (
              <div>
                <label className="section-title mb-1.5 flex items-center gap-1">
                  Sectores
                  <InfoTip texto="Los sectores que este encargado va a poder ver y gestionar. Solo aplica al rol Encargado; un Administrador ve todos." />
                </label>
                <div className="max-h-40 overflow-auto border border-content-border rounded-lg p-2 space-y-1">
                  {sectores.filter((s) => s.activo !== false).map((s) => (
                    <label key={s.id} className="flex items-center gap-2 text-sm text-ink-secondary">
                      <input
                        type="checkbox"
                        className="accent-brand"
                        checked={form.sectorIds.includes(s.id)}
                        onChange={() => setForm({ ...form, sectorIds: toggleSector(form.sectorIds, s.id) })}
                      />
                      {s.nombre}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <button type="submit" disabled={crear.isPending} className="btn-primary w-full justify-center">
              {crear.isPending ? "Creando..." : "Crear usuario"}
            </button>
            {crear.isError && <p className="text-sm text-red-600">{errorMessage(crear.error, "No se pudo crear el usuario")}</p>}
          </form>
        </div>

        {/* Lista */}
        <div className="card p-5 lg:col-span-2">
          <h2 className="section-title mb-3">Usuarios del sistema</h2>
          {isLoading ? (
            <p className="text-ink-muted text-sm">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Sectores</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios?.map((u) => {
                    const esYo = u.id === actual?.id;
                    return (
                      <tr key={u.id} className={!u.activo ? "opacity-50" : ""}>
                        <td>
                          {u.apellido ? `${u.apellido}, ${u.nombre}` : u.nombre}
                          {esYo && <span className="ml-2 text-xs text-ink-muted">(vos)</span>}
                        </td>
                        <td>{u.email}</td>
                        <td>
                          <span className={u.role === "ADMIN" ? "badge badge-mant" : "badge badge-fs"}>
                            {u.role === "ADMIN" ? "Administrador" : "Encargado"}
                          </span>
                        </td>
                        <td>{u.role === "ADMIN" ? "—" : u.sectores.map((s) => s.nombre).join(", ") || "—"}</td>
                        <td>{u.activo ? <span className="badge badge-op">Activo</span> : <span className="badge badge-baja">Inactivo</span>}</td>
                        <td className="text-right whitespace-nowrap">
                          <button onClick={() => abrirEdicion(u)} className="btn-ghost">
                            Editar
                          </button>
                          {!esYo && (
                            <button onClick={() => confirmarBaja(u)} className="btn-ghost">
                              {u.activo ? "Dar de baja" : "Reactivar"}
                            </button>
                          )}
                          {!esYo && (
                            <button onClick={() => confirmarEliminar(u)} className="btn-ghost text-red-600 hover:text-red-700">
                              Eliminar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de edición */}
      {editando && edit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setEditando(null)}>
          <div className="card p-6 w-full max-w-lg" style={{ boxShadow: "var(--shadow-lg)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="font-heading font-bold text-lg text-ink-primary mb-1">Editar usuario</h3>
            <p className="text-sm text-ink-muted mb-4">{editando.email}</p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                guardarEdicion.mutate();
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="section-title block mb-1.5">Nombre</label>
                  <input required value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} className="input" />
                </div>
                <div>
                  <label className="section-title block mb-1.5">Apellido</label>
                  <input required value={edit.apellido} onChange={(e) => setEdit({ ...edit, apellido: e.target.value })} className="input" />
                </div>
              </div>
              <div>
                <label className="section-title block mb-1.5">Email de acceso</label>
                <input type="email" required value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} className="input" />
              </div>
              <div>
                <label className="section-title block mb-1.5">Nueva contraseña (dejar en blanco para no cambiar)</label>
                <input
                  type="password"
                  minLength={6}
                  value={edit.password}
                  onChange={(e) => setEdit({ ...edit, password: e.target.value })}
                  placeholder="••••••••"
                  className="input"
                />
              </div>
              <div>
                <label className="section-title mb-1.5 flex items-center gap-1">
                Rol
                <InfoTip texto="Administrador: acceso total (usuarios, liquidaciones, configuración, todos los sectores). Encargado de sector: solo ve y gestiona los sectores que le asignes abajo." />
              </label>
                <select
                  value={edit.role}
                  disabled={editando.id === actual?.id}
                  onChange={(e) => setEdit({ ...edit, role: e.target.value as "ADMIN" | "ENCARGADO" })}
                  className="input disabled:opacity-60"
                >
                  <option value="ENCARGADO">Encargado de sector</option>
                  <option value="ADMIN">Administrador</option>
                </select>
              </div>
              {edit.role === "ENCARGADO" && sectores && sectores.length > 0 && (
                <div>
                  <label className="section-title mb-1.5 flex items-center gap-1">
                  Sectores
                  <InfoTip texto="Los sectores que este encargado va a poder ver y gestionar. Solo aplica al rol Encargado; un Administrador ve todos." />
                </label>
                  <div className="max-h-40 overflow-auto border border-content-border rounded-lg p-2 space-y-1">
                    {sectores.filter((s) => s.activo !== false).map((s) => (
                      <label key={s.id} className="flex items-center gap-2 text-sm text-ink-secondary">
                        <input
                          type="checkbox"
                          className="accent-brand"
                          checked={edit.sectorIds.includes(s.id)}
                          onChange={() => setEdit({ ...edit, sectorIds: toggleSector(edit.sectorIds, s.id) })}
                        />
                        {s.nombre}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              {editando.id !== actual?.id && (
                <label className="flex items-center gap-2 text-sm text-ink-secondary">
                  <input type="checkbox" className="accent-brand" checked={edit.activo} onChange={(e) => setEdit({ ...edit, activo: e.target.checked })} />
                  Usuario activo
                </label>
              )}

              {guardarEdicion.isError && <p className="text-sm text-red-600">{errorMessage(guardarEdicion.error, "No se pudo guardar")}</p>}

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditando(null)} className="btn-secondary">
                  Cancelar
                </button>
                <button type="submit" disabled={guardarEdicion.isPending} className="btn-primary">
                  {guardarEdicion.isPending ? "Guardando..." : "Guardar cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
