# Imagen única que compila el backend (Express) y el frontend (Vite/React) y
# los corre como un solo servicio: el server sirve el frontend compilado
# además de la API. Pensada para Railway (o cualquier host con Docker) con
# un volumen persistente montado para la base SQLite.
FROM node:22-slim

WORKDIR /app

# Instala dependencias primero (aprovecha el cache de Docker si el código
# cambia pero los package.json no).
COPY package.json package-lock.json ./
COPY server/package.json server/package.json
COPY web/package.json web/package.json
RUN npm ci

COPY . .

RUN npx prisma generate --schema server/prisma/schema.prisma
RUN npm run build

ENV NODE_ENV=production
EXPOSE 4000

CMD ["npm", "run", "start"]
