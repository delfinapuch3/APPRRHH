# Gestión de Operarios

App para llevar fichadas, calcular horas normales/extra y francos compensatorios, liquidar sueldos, medir asistencia y llevar vacaciones de los operarios.

## Cómo levantarla (primera vez / clonando el repo)

```
git clone <url-del-repo>
cd gestion-operarios
npm install
cp server/.env.example server/.env
cd server && npx prisma migrate deploy && npx tsx prisma/seed.ts && cd ..
npm run dev
```

- Backend: http://localhost:4000
- Frontend: http://localhost:5173

Si ya tenías el repo clonado y solo estás levantando la app de nuevo, alcanza con `npm install` (si cambiaron dependencias) y `npm run dev`.

## Usuarios de prueba (creados por el seed)

- Admin/RRHH: `admin@empresa.com` / `admin123`
- Encargado de sector: `encargado@empresa.com` / `encargado123`

Cambiá estas contraseñas antes de usar la app con datos reales (desde `/configuracion` como admin, o directamente en la base).

## Reglas de cálculo (editables desde Configuración)

- Horas normales: primeras 8 horas trabajadas por día, lunes a sábado.
- Extra 50%: a partir de la 9na hora, lunes a sábado hasta las 12:00.
- Extra 100%: sábados desde las 12:00 y domingos/feriados.
- Franco compensatorio: se genera automáticamente (8 horas a valor hora normal) cada vez que un empleado trabaja un domingo o feriado.
- Turnos que cruzan la medianoche (ej. 20 a 4): se reparten automáticamente entre los dos días calendario según la hora real de cada tramo.

## Ausencias

Tipos disponibles: licencia por ART, vacaciones, licencia gremial, permiso personal, enfermedad/accidente inculpable, licencia sin goce de sueldo, suspensión, fallecimiento de familiar, examen/estudio, tardanza, ausencia injustificada y otra (requiere aclarar el motivo).

Se pueden cargar de dos formas:
- Desde **Asistencia** (vista por período o por día): clasificás las faltas que el sistema detectó automáticamente (día sin fichada).
- Desde la ficha del empleado (pestaña "ausencias"): registrás cualquier incidencia para un rango de fechas, incluidas las que no implican falta total (tardanza, suspensión, etc).

## Importar fichadas del reloj

El importador soporta el formato con columna "Marcaciones" combinada (ej. `E 08:07 - S 15:56`) y detecta automáticamente los turnos que cruzan la medianoche: si un día queda con una entrada sin cierre, prueba emparejarla con la primera marca del día siguiente y, si la duración resultante es razonable para un turno (2 a 14 horas), la toma como la salida real. Si no encuentra un cierre plausible, la deja marcada para revisión manual en el resumen de la importación.

## Empresas y sectores

Los empleados se agrupan por Empresa (ej. POLCECAL, POLYSAN) y Sector (ej. Francisco, Administración) — se gestionan desde Configuración. Los encargados de sector solo ven y operan sobre los empleados de sus sectores asignados.

## Validación de horas extra

Cada empleado tiene una pestaña "fichadas" con el detalle día por día: horas trabajadas, extra 50%, extra 100%, y si trabajó un domingo/feriado. Las horas extra requieren que RRHH las valide (botón verde "Validar") antes de que se incluyan en una liquidación — si generás una liquidación con horas extra sin validar, quedan afuera y se avisa en pantalla.

## Horas teóricas

Cada empleado tiene un campo "horas teóricas diarias" (default 8, ajustable a 4 para pasantes u otros esquemas reducidos). Se usa para comparar horas trabajadas vs. teóricas por sector en el Dashboard.

## Restablecer la base de datos con datos de ejemplo

```
cd server
rm prisma/dev.db
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

## Notas técnicas

- Backend: Express + Prisma + SQLite (`server/prisma/dev.db`).
- Frontend: React + Vite + Tailwind.
- El campo `xlsx` (import de Excel) tiene una vulnerabilidad conocida (ReDoS/prototype pollution) sin parche disponible vía npm al momento de crear este proyecto. Como los archivos los sube el propio administrador desde su reloj biométrico (no son archivos de terceros no confiables), el riesgo es bajo, pero conviene revisar `npm audit` periódicamente por si SheetJS publica una versión corregida.
