#!/bin/sh
# Comando de arranque para Render (u otro host Docker): aplica las migraciones,
# siembra los datos base (sin bloquear si ya existen o falla) y levanta el server.
# Se usa como "Docker Command" del servicio (o como CMD del Dockerfile).
set -e

echo "==> Aplicando migraciones..."
npx prisma migrate deploy --schema server/prisma/schema.prisma

echo "==> Sembrando datos base (si faltan)..."
npx tsx server/prisma/seed.ts || echo "==> Seed omitido, continuo igual"

echo "==> Arrancando el servidor..."
npm run start
