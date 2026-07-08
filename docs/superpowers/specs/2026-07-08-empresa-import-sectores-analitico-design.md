# Diseño: Empresa en import, desactivar sectores, colores del Analítico

**Fecha:** 2026-07-08
**Autor:** Bernardo Strupp (con Claude)
**Estado:** Aprobado

Tres cambios independientes sobre la app existente.

## Modelo relevante

`Employee → Sector (opcional) → Empresa (opcional)`. El empleado NO tiene empresa directa:
la empresa se deriva del sector. La analítica "empleados por empresa" ya usa `sector.empresa.nombre`.

---

## 1. Empresa en el import de empleados (empresa vía sector)

**Backend** `server/src/routes/importEmpleados.ts`
- Agregar `empresa: z.string().optional()` al `mapping` del `confirmSchema`.
- Agregar `"empresa"` a `KEYWORDS` (para detección de hoja).
- En `/confirm`, por cada fila:
  1. Si hay columna empresa: resolver empresa por nombre (case-insensitive, trim);
     **crearla si no existe**.
  2. Si hay columna sector: resolver el sector por nombre **dentro de esa empresa**
     (`(empresaId, nombreLower)`); **crearlo bajo esa empresa si no existe**. Asignar `sectorId`.
  3. Si hay sector pero no empresa: comportamiento actual (match por nombre global).
- **Comportamiento nuevo:** el import crea empresa/sector faltantes en vez de dejar "sin asignar".

**Frontend** `web/src/pages/Empleados.tsx`
- Agregar `["empresa", "Empresa (opcional)"]` a `MAPPING_FIELDS`.
- Agregar `empresa: ""` al estado `mapping` y a `guessMapping` (`guess("empresa")`).
- El select de la columna Empresa aparece en la grilla de mapeo (ya se genera desde `MAPPING_FIELDS`).

*(El formulario manual de alta de empleado no cambia: sigue eligiendo sector.)*

## 2. Desactivar / reactivar sectores

**Backend:** sin cambios (`PUT /sectores/:id { activo }` ya existe).

**Frontend** `web/src/pages/Configuracion.tsx`
- En la sección Sectores: mostrar estado (badge activo/inactivo) y botón
  **"Desactivar" / "Reactivar"** que hace `PUT /sectores/:id { activo: !activo }` e invalida la query.

**Filtrar inactivos en los selects de asignación** (para que "dejen de aparecer"):
- `Empleados.tsx`: el `<select>` de sector del formulario manual filtra `s.activo !== false`.
- `AdministracionUsuarios.tsx`: los checkboxes de sectores filtran `s.activo !== false`.
- (La sección Sectores de Configuración sí muestra todos, con su toggle.)

## 3. Colores del Analítico acordes a la estética

**Frontend** `web/src/pages/AnaliticoPersonal.tsx`
- Reemplazar `COLORES = ["#0ea5e9", "#f59e0b", "#94a3b8", "#8b5cf6", "#ef4444", "#22c55e"]`
  por paleta de marca verde/ámbar:
  `["#1E7D34", "#E8A020", "#46B869", "#C17F10", "#0E7C86", "#94A3B8"]`.
- Barra "por antigüedad": `fill="#0ea5e9"` → `#1E7D34` (verde primario).
- Línea "ausentismo por mes": `stroke="#ef4444"` → `#E8A020` (ámbar acento).
- `StatCard`: alinear al estilo del Dashboard (`section-title` para el título,
  `font-heading text-3xl font-bold text-ink-primary` para el valor).
- Títulos de sección `font-medium text-slate-700` → `.section-title`.

## Criterios de éxito

- Import con columnas Empresa+Sector: el empleado queda con un sector bajo la empresa correcta
  (creándolos si no existían); la analítica "por empresa" lo refleja.
- Un sector desactivado no aparece en los selects de asignación pero sí en Configuración (con Reactivar).
- El Analítico usa la paleta verde/ámbar en todos los gráficos y tarjetas.
- `npm run build -w server` y `-w web` compilan sin errores.
