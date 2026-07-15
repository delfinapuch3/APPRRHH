import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const FERIADOS_2026: { fecha: string; nombre: string }[] = [
  { fecha: "2026-01-01", nombre: "Año Nuevo" },
  { fecha: "2026-02-16", nombre: "Carnaval" },
  { fecha: "2026-02-17", nombre: "Carnaval" },
  { fecha: "2026-03-24", nombre: "Día Nacional de la Memoria por la Verdad y la Justicia" },
  { fecha: "2026-04-02", nombre: "Día del Veterano y de los Caídos en la Guerra de Malvinas" },
  { fecha: "2026-04-03", nombre: "Viernes Santo" },
  { fecha: "2026-05-01", nombre: "Día del Trabajador" },
  { fecha: "2026-05-25", nombre: "Día de la Revolución de Mayo" },
  { fecha: "2026-06-17", nombre: "Paso a la Inmortalidad del Gral. Martín Miguel de Güemes" },
  { fecha: "2026-06-20", nombre: "Paso a la Inmortalidad del Gral. Manuel Belgrano" },
  { fecha: "2026-07-09", nombre: "Día de la Independencia" },
  { fecha: "2026-08-17", nombre: "Paso a la Inmortalidad del Gral. José de San Martín" },
  { fecha: "2026-10-12", nombre: "Día del Respeto a la Diversidad Cultural" },
  { fecha: "2026-11-20", nombre: "Día de la Soberanía Nacional" },
  { fecha: "2026-12-08", nombre: "Inmaculada Concepción de María" },
  { fecha: "2026-12-25", nombre: "Navidad" },
];

async function main() {
  await prisma.payrollConfig.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });

  for (const f of FERIADOS_2026) {
    await prisma.holiday.upsert({
      where: { fecha: new Date(f.fecha) },
      update: { nombre: f.nombre },
      create: { fecha: new Date(f.fecha), nombre: f.nombre, tipo: "NACIONAL" },
    });
  }

  const adminPassword = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.upsert({
    where: { email: "admin@empresa.com" },
    update: {},
    create: {
      email: "admin@empresa.com",
      passwordHash: adminPassword,
      nombre: "Administrador RRHH",
      role: "ADMIN",
    },
  });

  const encargadoPassword = await bcrypt.hash("encargado123", 10);
  const encargado = await prisma.user.upsert({
    where: { email: "encargado@empresa.com" },
    update: {},
    create: {
      email: "encargado@empresa.com",
      passwordHash: encargadoPassword,
      nombre: "Encargado de Sector",
      role: "ENCARGADO",
    },
  });

  const polcecal = await prisma.empresa.upsert({
    where: { nombre: "POLCECAL" },
    update: {},
    create: { nombre: "POLCECAL" },
  });
  const polysan = await prisma.empresa.upsert({
    where: { nombre: "POLYSAN" },
    update: {},
    create: { nombre: "POLYSAN" },
  });

  const sectorAdministracion = await prisma.sector.upsert({
    where: { id: "sector-administracion" },
    update: {},
    create: { id: "sector-administracion", nombre: "Administración" },
  });
  await prisma.sector.upsert({
    where: { id: "sector-planta" },
    update: {},
    create: { id: "sector-planta", nombre: "Planta" },
  });

  await prisma.userSector.upsert({
    where: { userId_sectorId: { userId: encargado.id, sectorId: sectorAdministracion.id } },
    update: {},
    create: { userId: encargado.id, sectorId: sectorAdministracion.id },
  });

  console.log("Seed completado.");
  console.log("Admin: admin@empresa.com / admin123");
  console.log("Encargado: encargado@empresa.com / encargado123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
