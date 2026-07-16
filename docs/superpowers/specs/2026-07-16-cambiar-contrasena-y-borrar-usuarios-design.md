# Diseño: cambiar contraseña propia + borrar usuarios (admin)

**Fecha:** 2026-07-16
**Autor:** Bernardo Strupp (con Claude)
**Estado:** Aprobado

Dos funciones sobre la gestión de usuarios.

## 1. Mi cuenta — cambiar la propia contraseña

Cualquier usuario logueado (admin o encargado) puede cambiar **su propia** contraseña.

**Backend** — `server/src/routes/auth.ts`
- `POST /api/auth/change-password` (con `requireAuth`).
- Body: `{ currentPassword, newPassword }` (zod: `newPassword` min 6).
- Busca el usuario por `req.user.id`, compara `currentPassword` con `passwordHash` (bcrypt).
  Si no coincide → `400 { error: "La contraseña actual es incorrecta" }`.
- Si ok, guarda `bcrypt.hash(newPassword, 10)`. Responde `{ ok: true }`. La sesión sigue válida.

**Frontend**
- Nueva página `web/src/pages/MiCuenta.tsx` en la ruta `/mi-cuenta` (dentro del layout protegido):
  - Tarjeta con datos del usuario (nombre, apellido, email, rol) — solo lectura.
  - Tarjeta "Cambiar contraseña": campos *contraseña actual*, *nueva*, *confirmar nueva*.
    Validación cliente: nueva === confirmar y min 6. El error de contraseña actual lo da el server.
    Al guardar bien: limpia el form y muestra mensaje de éxito.
- Ruta registrada en `App.tsx`.
- Acceso: el bloque del usuario en el footer del sidebar (`Layout.tsx`) se vuelve un enlace a `/mi-cuenta`.
- Helper en `api/client` o llamada directa con `api.post("/auth/change-password", ...)`.

## 2. Admin borra usuarios

**Backend** — `server/src/routes/usuarios.ts`
- `DELETE /:id` (con `requireAdmin`).
- **Guarda:** si `req.params.id === req.user.id` → `400 { error: "No podés borrarte a vos mismo" }`.
- **Borrado seguro:** contar registros asociados que bloquean por FK obligatoria:
  - `importBatch` (usuarioId), `absence` (cargadoPorId), `payrollPeriod` (generadoPorId).
  - Si el total > 0 → `409 { error: "No se puede borrar: el usuario tiene registros asociados (importaciones, ausencias o liquidaciones). Desactivalo en su lugar." }`.
- Si no tiene nada asociado → `prisma.user.delete({ where: { id } })`. Las filas de `UserSector`
  se borran solas (onDelete: Cascade); `DailyCalculation.validadoPor` es opcional (se pone null).
- Responde `{ ok: true }`.

**Frontend** — `web/src/pages/AdministracionUsuarios.tsx`
- Botón **"Eliminar"** por fila (no se muestra en la fila del usuario logueado).
- Pide **confirmación** antes de borrar (confirm nativo con el nombre del usuario).
- Mutación `DELETE /usuarios/:id`, invalida la query de usuarios.
- Si el borrado devuelve 409, muestra el aviso con `errorMessage` (queda la opción "Dar de baja").

## Relaciones a User (referencia)

- `UserSector.user` → onDelete Cascade (se limpia solo).
- `ImportBatch.usuario`, `Absence.cargadoPor`, `PayrollPeriod.generadoPor` → obligatorias (Restrict) → bloquean el borrado si hay registros.
- `DailyCalculation.validadoPor` → opcional (se pone null).

## Criterios de éxito

- Un usuario cambia su contraseña desde `/mi-cuenta`; con la clave actual mal, ve el error; con la nueva puede volver a entrar.
- Un admin borra un usuario sin registros asociados; si tiene registros, ve el aviso y no se borra.
- Un admin no puede borrarse a sí mismo.
- `npm run build -w server` y `-w web` compilan sin errores.
