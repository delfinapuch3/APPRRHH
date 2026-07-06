# Diseño: Portar la identidad visual de Mantenimiento a APPRRHH

**Fecha:** 2026-07-06
**Autor:** Bernardo Strupp (con Claude)
**Estado:** Aprobado

## Objetivo

Traer la identidad visual de la app **Mantenimiento** (`procedimientos-polcecal/mantenimiento`)
a **APPRRHH / Gestión de Operarios**, para que ambas se vean como parte de un mismo sistema.
Cambio **puramente visual**: no se toca backend, endpoints, lógica de negocio, rutas ni autenticación.

## Alcance

- **Retrofit completo:** shell (sidebar + login) + estilos/tokens globales + las 9 páginas internas.
- **Misma marca que Mantenimiento:** logo POLCECAL/POLYSAN + naranja `#F59E0B`.

## Contexto de los stacks

- **APPRRHH (destino):** React 18 + Vite + Tailwind v3, SPA con react-router. Hoy usa utilidades
  Tailwind "crudas" con paleta slate y fuentes del sistema.
- **Mantenimiento (referencia):** Next.js + Tailwind v4. Su diseño vive en `app/globals.css`
  como variables CSS + clases semánticas de componente, más fuentes de Google.

## Enfoque

Portar el sistema de diseño respetando el stack de APPRRHH:

1. **`web/src/index.css`** — traer variables CSS, fuentes y clases de componente vía
   `@layer components` (Tailwind v3), casi idénticas a Mantenimiento.
2. **`web/tailwind.config.js`** — extender `theme` con colores de marca, fuentes, sombras y radios
   como tokens, para poder usar utilidades (`text-brand`, `font-heading`) sin divergir del look.

Esto replica cómo está construido Mantenimiento (clases semánticas + utilidades), manteniendo
las dos apps fáciles de sincronizar visualmente.

## Tokens de diseño

- **Fuentes:** Syne (títulos/marca/números), DM Sans (texto), JetBrains Mono (mono).
- **Marca:** `--orange #F59E0B`, `--orange-dark #D97706`, `--orange-light #FEF3C7`; acento verde.
- **Sidebar:** `--sidebar-bg #0A0F1C`, borde `#1E2A3A`, texto `#94A3B8`, hover `#131D2E`, activo `#1A2840`.
- **Contenido:** `--bg #F1F5F9`, `--card #FFFFFF`, `--border #E2E8F0`.
- **Texto:** primario `#0F172A`, secundario `#475569`, muted `#94A3B8`.
- **Sombras:** `--shadow-sm/-shadow/-shadow-lg` suaves. **Radios:** 8px (controles) / 12px (cards).

## Componentes (clases en `index.css`)

`.card`, `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.input`, `.badge` (+ variantes de estado
`.badge-op/-mant/-rep/-st/-fs/-baja`), `.table-base`, `.section-title`, `.page-header`,
`.page-subheader`, `.empty-state`, animación `.fade-up` (+ delays), scrollbar fino y `:focus-visible` accesible.

## Piezas

### 1. Estilos globales — `web/src/index.css`
Reemplazar el CSS mínimo actual por: import de fuentes, `:root` con tokens, `@layer components`
con las clases de arriba, reglas base (body con DM Sans, headings Syne).

### 2. Shell — `web/src/components/Layout.tsx`
- Sidebar oscuro 240px: logo arriba + subtítulo uppercase "Gestión de Operarios".
- Nav con **ícono SVG por sección** (Dashboard, Empleados, Fichadas, Asistencia, Vacaciones,
  Francos, Liquidaciones, Configuración). Item activo naranja con borde izquierdo.
- Footer: nombre + rol del usuario + "Cerrar sesión".
- **Responsive:** barra superior fija en mobile + sidebar deslizable con overlay (hoy no es responsive).
- Se respeta el filtrado `adminOnly` existente (Liquidaciones/Configuración solo admin).

### 3. Login — `web/src/pages/Login.tsx`
- Panel partido: izquierda oscura (logo, título "Sistema de Gestión de **Operarios**", grilla
  decorativa, 3 destacados **estáticos**: Asistencia / Horas extra / Liquidaciones); derecha blanca
  con el formulario (`.input`, `.btn-primary`, mensaje de error estilizado).
- Colapsa a solo-formulario en mobile.
- Mantiene la lógica actual (`login(email, password)` → `/dashboard`, manejo de error).

### 4. Retrofit de páginas (9)
Dashboard, Empleados, EmpleadoDetalle, Fichadas, Asistencia, Vacaciones, Francos, Liquidaciones,
Configuración. Solo markup/clases, **sin tocar** queries, mutations ni cálculos:
- Métricas → `.card` con números en Syne.
- Tablas → `.table-base`.
- Botones → `.btn-primary/secondary/ghost`.
- Inputs/selects → `.input`; estados → `.badge-*`.
- Encabezados → `.page-header` + `.page-subheader`.
- Entrada de página con `.fade-up`.

### 5. Assets
- Crear `web/public/` y copiar `logo.svg` (+ `logo.png`) desde Mantenimiento.
- Favicon y `<title>` acordes en `web/index.html`.

## Fuera de alcance

Backend, endpoints, lógica de negocio, rutas, autenticación, dependencias nuevas (las fuentes
entran por `@import` de Google Fonts; no se agregan libs).

## Criterios de éxito

- APPRRHH se ve claramente como "hermana" de Mantenimiento (fuentes, naranja, sidebar oscuro, cards, tablas).
- `npm run build -w web` compila sin errores.
- Toda la funcionalidad existente sigue operando igual (login, navegación, tablas, importadores, cálculos).
- Responsive básico funcionando (sidebar mobile).
