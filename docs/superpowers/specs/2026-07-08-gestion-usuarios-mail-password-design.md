# Diseño: Gestión de mails, contraseñas y sectores de usuarios

**Fecha:** 2026-07-08
**Autor:** Bernardo Strupp (con Claude)
**Estado:** Aprobado

## Objetivo

Permitir que el administrador configure **emails y contraseñas** de los usuarios (y sus
sectores asignados) desde la app. Extiende la página existente `AdministracionUsuarios.tsx`
(ruta `/administracion/usuarios`), sin duplicar en Configuración.

## Contexto (lo que ya existe)

- **Backend** `server/src/routes/usuarios.ts` (admin-only, bcrypt):
  - `GET /` lista usuarios con `{ id, email, nombre, apellido, role, activo, sectores[] }`.
  - `POST /` crea: email, password, nombre, apellido, role, sectorIds.
  - `PUT /:id` edita: nombre, apellido, role, activo, **password (opcional)**, sectorIds.
    **No** acepta `email`.
- **Frontend** `web/src/pages/AdministracionUsuarios.tsx`: crea usuarios y, por fila, cambia rol
  (select inline) y activa/desactiva. **No** permite resetear contraseña, editar email ni asignar sectores.

## Alcance

1. **Resetear contraseña** de un usuario existente (backend ya lo soporta; falta UI).
2. **Editar email** de un usuario existente (falta en backend y UI).
3. **Asignar sectores** a los usuarios desde la UI (backend ya lo soporta; falta UI).

Fuera de alcance: login con Google/Firebase (posterior; reutiliza el modelo `User`).

## Diseño

### Backend — `server/src/routes/usuarios.ts`
- Agregar `email: z.string().email().optional()` a `usuarioUpdateSchema`; incluirlo en el `data`
  del `update`.
- **Email duplicado**: envolver create y update para capturar el error único de Prisma (`P2002`)
  y responder `409 { error: "Ese email ya está en uso" }`.
- **Guarda de auto-bloqueo**: en `PUT /:id`, si `req.params.id === req.user.id` y el cambio
  desactiva (`activo === false`) o baja el rol (`role === "ENCARGADO"`), responder
  `400 { error: "No podés quitarte a vos mismo el acceso de administrador" }`.
  (`req.user` lo provee `requireAuth`/`requireAdmin`.)
- `GET /usuarios` ya devuelve `sectores` — no requiere cambios.

### Frontend — `web/src/pages/AdministracionUsuarios.tsx`
- Cargar sectores: `GET /sectores` → `{ id, nombre }[]`.
- **Formulario "Nuevo usuario"**: agregar checkboxes de **sectores** (envía `sectorIds`).
- **Editar por fila**: botón "Editar" que abre un formulario (inline desplegable o modal) con
  email, nombre, apellido, rol, sectores (checkboxes), activo, y campo
  **"Nueva contraseña (dejar en blanco para no cambiar)"**. Guardar → `PUT /:id` con solo los
  campos presentes (password se omite si está vacío).
- **Tabla**: nueva columna **Sectores** (lista de nombres).
- **Auto-guarda en UI**: usando `useAuth()`, deshabilitar "dar de baja" y bajar rol en la fila
  del usuario logueado.
- **Errores**: mostrar con el helper `errorMessage` (email repetido, validación).
- **Estilo**: alinear inputs/tabla/botones al sistema de diseño (`.input`, `.table-base`,
  `.badge`, `.btn-*`) en vez de los estilos slate viejos.

## Criterios de éxito

- Un admin puede: crear un usuario con sectores, cambiarle el email, resetearle la contraseña,
  reasignarle sectores, cambiar rol y activar/desactivar.
- Email duplicado muestra un mensaje claro y no rompe.
- Un admin no puede quitarse su propio acceso de administrador.
- `npm run build -w web` y `npm run build -w server` compilan sin errores.
- La funcionalidad existente (crear, rol inline, baja/reactivación) sigue funcionando.
