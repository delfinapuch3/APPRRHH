# Deploy — Render + Neon (gratis, sin tarjeta)

La app corre como **un solo servicio**: el server Express sirve la API **y** el
frontend compilado. Se despliega con el `Dockerfile` de la raíz en **Render**
(host del contenedor) usando **Neon** como base de datos PostgreSQL.

```
Usuario → Render (Docker: Express + web/dist) → Neon (Postgres)
```

Ninguno de los dos servicios pide tarjeta de crédito.

---

## Paso 1 — Base de datos en Neon

1. Entrá a **https://neon.tech** y creá una cuenta (podés usar tu cuenta de Google/GitHub).
2. **Create project** → nombre `apprrhh` (region: la más cercana, ej. *AWS us-east*).
3. Cuando termine, te muestra el **connection string**. Copialo — se ve así:
   ```
   postgresql://usuario:password@ep-xxxx.us-east-2.aws.neon.tech/dbname?sslmode=require
   ```
   > Si no aparece, andá a **Dashboard → Connection Details** y copiá la
   > "Connection string" (con `?sslmode=require`).

Guardá ese string, lo vas a pegar en Render.

## Paso 2 — Servicio en Render

1. Entrá a **https://render.com** y creá una cuenta (con GitHub, así ve el repo).
2. Autorizá a Render a acceder al repo **delfinapuch3/APPRRHH**.
3. **New +** → **Blueprint** → elegí el repo. Render detecta el archivo
   `render.yaml` y propone crear el servicio `apprrhh`.
4. Antes de crear, te va a pedir la variable **`DATABASE_URL`** (está marcada como
   "manual"): pegá ahí el connection string de Neon del Paso 1.
   *(`JWT_SECRET` lo genera Render solo; `NODE_ENV` ya viene seteado.)*
5. **Apply / Create** — Render construye la imagen Docker (tarda unos minutos la
   primera vez), aplica las migraciones a Neon, siembra el usuario admin y arranca.

## Paso 3 — Verificar

1. Cuando el estado quede en **Live**, Render te da una URL tipo
   `https://apprrhh.onrender.com`.
2. Probá que el backend responde: abrí `https://apprrhh.onrender.com/api/health`
   → debe decir `{"ok":true}`.
3. Abrí la URL principal y logueate con el usuario sembrado:
   - **admin@empresa.com** / **admin123**
4. **Cambiá esa contraseña** enseguida desde *Administración → Usuarios*.

---

## Cosas para tener en cuenta

- **El plan gratis de Render "se duerme"** tras ~15 min sin uso. La primera visita
  después de dormir tarda ~30-50 s en despertar; luego va normal. (Para producción
  seria conviene un plan pago o mantenerlo despierto con un ping.)
- **Cada `git push` a `main`** dispara un re-deploy automático en Render.
- **Los datos viven en Neon**, no en el contenedor: los redeploys **no** borran nada.

## Recuperar el acceso de admin (si te olvidás la contraseña)

Las contraseñas se guardan hasheadas, así que no se pueden "leer". Para crear un
admin nuevo o resetear la clave de uno existente, hay un script que corre **fuera
de la app**, directo contra la base:

```
cd server
npx tsx prisma/reset-admin.ts <email> <password> ["Nombre Apellido"] [ADMIN|ENCARGADO]
```

Ejemplos:
```
# Resetear la clave del admin de siempre
npx tsx prisma/reset-admin.ts admin@empresa.com NuevaClave123

# Crear un admin nuevo
npx tsx prisma/reset-admin.ts jefe@polcecal.com MiClave123 "Juan Perez" ADMIN
```

> **Importante:** el script usa el `DATABASE_URL` del entorno. Para tocar la base de
> **producción**, poné el connection string de Neon en `DATABASE_URL` (en `server/.env`
> o inline) antes de correrlo. Cualquiera con ese string puede resetear el admin, así
> que guardalo con cuidado.

Alternativa sin script: en la consola SQL de Neon o con `npx prisma studio` podés ver
la tabla `User`, pero igual necesitás generar un hash bcrypt para la contraseña — por
eso el script es lo más práctico.

## Desarrollo local (cambió)

La app ya **no usa SQLite**. Para levantarla local, en `server/.env` poné un
`DATABASE_URL` de Postgres:

- **Opción fácil:** creá una **rama gratis** en el mismo proyecto de Neon
  (Neon → Branches → New branch) y usá su connection string. Así cada dev tiene su
  propia base sin pisar la de producción.
- **Opción local:** instalá Postgres en tu máquina y usá
  `postgresql://postgres:postgres@localhost:5432/apprrhh`.

Después, la primera vez:
```
cd server
npx prisma migrate deploy      # crea las tablas
npx tsx prisma/seed.ts         # crea admin + datos base
cd ..
npm run dev
```
