import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, errorMessage } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.js";

export default function MiCuenta() {
  const { user } = useAuth();
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirm: "" });
  const [localError, setLocalError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState(false);

  const cambiar = useMutation({
    mutationFn: async () =>
      api.post("/auth/change-password", {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      }),
    onSuccess: () => {
      setForm({ currentPassword: "", newPassword: "", confirm: "" });
      setOkMsg(true);
    },
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setOkMsg(false);
    if (form.newPassword.length < 6) {
      setLocalError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (form.newPassword !== form.confirm) {
      setLocalError("La nueva contraseña y la confirmación no coinciden.");
      return;
    }
    if (form.newPassword === form.currentPassword) {
      setLocalError("La nueva contraseña tiene que ser distinta a la actual.");
      return;
    }
    cambiar.mutate();
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="page-header">Mi cuenta</h1>
        <p className="page-subheader">Tus datos y seguridad</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Datos */}
        <div className="card p-5">
          <h2 className="section-title mb-3">Mis datos</h2>
          <dl className="space-y-3 text-sm">
            <div>
              <dt className="section-title">Nombre</dt>
              <dd className="text-ink-primary">{user?.nombre}</dd>
            </div>
            <div>
              <dt className="section-title">Email</dt>
              <dd className="text-ink-primary">{user?.email}</dd>
            </div>
            <div>
              <dt className="section-title">Rol</dt>
              <dd>
                <span className={user?.role === "ADMIN" ? "badge badge-mant" : "badge badge-fs"}>
                  {user?.role === "ADMIN" ? "Administrador" : "Encargado de sector"}
                </span>
              </dd>
            </div>
          </dl>
          <p className="text-xs text-ink-muted mt-4">
            Para cambiar tu nombre o email, pedíselo a un administrador desde Administración → Usuarios.
          </p>
        </div>

        {/* Cambiar contraseña */}
        <div className="card p-5">
          <h2 className="section-title mb-3">Cambiar contraseña</h2>
          <form onSubmit={onSubmit} className="space-y-3">
            <div>
              <label className="section-title block mb-1.5">Contraseña actual</label>
              <input
                type="password"
                required
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="section-title block mb-1.5">Nueva contraseña</label>
              <input
                type="password"
                required
                minLength={6}
                value={form.newPassword}
                onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                placeholder="Mínimo 6 caracteres"
                className="input"
              />
            </div>
            <div>
              <label className="section-title block mb-1.5">Confirmar nueva contraseña</label>
              <input
                type="password"
                required
                value={form.confirm}
                onChange={(e) => setForm({ ...form, confirm: e.target.value })}
                className="input"
              />
            </div>

            {localError && <p className="text-sm text-red-600">{localError}</p>}
            {cambiar.isError && <p className="text-sm text-red-600">{errorMessage(cambiar.error, "No se pudo cambiar la contraseña")}</p>}
            {okMsg && <p className="text-sm text-green-700">Contraseña actualizada correctamente.</p>}

            <button type="submit" disabled={cambiar.isPending} className="btn-primary">
              {cambiar.isPending ? "Guardando..." : "Cambiar contraseña"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
