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
- Encargado de obra: `encargado@empresa.com` / `encargado123`

Cambiá estas contraseñas antes de usar la app con datos reales (desde `/configuracion` como admin, o directamente en la base).

## Reglas de cálculo (editables desde Configuración)

- Horas normales: primeras 8 horas trabajadas por día, lunes a sábado.
- Extra 50%: a partir de la 9na hora, lunes a sábado hasta las 12:00.
- Extra 100%: sábados desde las 12:00 y domingos/feriados.
- Franco compensatorio: se genera automáticamente (8 horas a valor hora normal) cada vez que un empleado trabaja un domingo o feriado.

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
