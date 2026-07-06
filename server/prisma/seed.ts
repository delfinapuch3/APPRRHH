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
      nombre: "Encargado de Obra",
      role: "ENCARGADO",
    },
  });

  const obra = await prisma.obra.upsert({
    where: { id: "obra-demo" },
    update: {},
    create: { id: "obra-demo", nombre: "Obra Demo - Edificio Central" },
  });

  await prisma.userObra.upsert({
    where: { userId_obraId: { userId: encargado.id, obraId: obra.id } },
    update: {},
    create: { userId: encargado.id, obraId: obra.id },
  });

  const empleadosDemo = [
    { legajo: "1001", nombre: "Juan", apellido: "Pérez", valorHoraNormal: 3500, fechaIngreso: "2018-03-01" },
    { legajo: "1002", nombre: "Carlos", apellido: "Gómez", valorHoraNormal: 3200, fechaIngreso: "2021-06-15" },
    { legajo: "1003", nombre: "Miguel", apellido: "Fernández", valorHoraNormal: 3800, fechaIngreso: "2010-01-10" },
  ];

  for (const e of empleadosDemo) {
    await prisma.employee.upsert({
      where: { legajo: e.legajo },
      update: {},
      create: {
        legajo: e.legajo,
        nombre: e.nombre,
        apellido: e.apellido,
        valorHoraNormal: e.valorHoraNormal,
        fechaIngreso: new Date(e.fechaIngreso),
        obraId: obra.id,
      },
    });
  }

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
