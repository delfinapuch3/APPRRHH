// Recuperación de acceso: crea un usuario admin nuevo o resetea la contraseña de
// uno existente, directamente contra la base (por si te olvidás la clave de admin).
//
// Uso (desde la carpeta server/, con DATABASE_URL apuntando a la base correcta):
//   npx tsx prisma/reset-admin.ts <email> <password> ["Nombre Apellido"] [ADMIN|ENCARGADO]
//
// Ejemplos:
//   npx tsx prisma/reset-admin.ts jefe@polcecal.com MiClaveSegura123
//   npx tsx prisma/reset-admin.ts jefe@polcecal.com MiClave123 "Juan Perez" ADMIN
//
// Para la base de PRODUCCIÓN, poné el connection string de Neon en DATABASE_URL
// (en server/.env o inline) antes de correrlo.

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const [email, password, nombreCompleto, rolArg] = process.argv.slice(2);

  if (!email || !password) {
    console.error('Uso: npx tsx prisma/reset-admin.ts <email> <password> ["Nombre Apellido"] [ADMIN|ENCARGADO]');
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("La contraseña debe tener al menos 6 caracteres.");
    process.exit(1);
  }

  const roleUpper = (rolArg ?? "ADMIN").toUpperCase();
  if (roleUpper !== "ADMIN" && roleUpper !== "ENCARGADO") {
    console.error(`Rol inválido: "${rolArg}". Usá ADMIN o ENCARGADO.`);
    process.exit(1);
  }
  const role = roleUpper as "ADMIN" | "ENCARGADO";

  const partes = (nombreCompleto ?? "Administrador").trim().split(/\s+/);
  const nombre = partes[0];
  const apellido = partes.slice(1).join(" ");

  const passwordHash = await bcrypt.hash(password, 10);

  const existente = await prisma.user.findUnique({ where: { email } });

  const user = await prisma.user.upsert({
    where: { email },
    update: { passwordHash, activo: true, role },
    create: { email, passwordHash, nombre, apellido, role, activo: true },
  });

  console.log(
    `${existente ? "Contraseña reseteada" : "Usuario creado"}: ${user.email} (${user.role}). Ya podés entrar con la nueva clave.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
