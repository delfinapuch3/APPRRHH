import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const empleados = await prisma.employee.findMany({
    select: { id: true, sectorId: true, sector: { select: { empresaId: true } } },
  });
  for (const e of empleados) {
    const empresaId = e.sector?.empresaId ?? null;
    if (empresaId) {
      await prisma.employee.update({ where: { id: e.id }, data: { empresaId } });
    }
  }
  console.log(`empresaId completado en ${empleados.filter((e) => e.sector?.empresaId).length}/${empleados.length} empleados`);

  const sectores = await prisma.sector.findMany({ orderBy: { createdAt: "asc" } });
  const grupos = new Map<string, typeof sectores>();
  for (const s of sectores) {
    const key = s.nombre.trim().toLowerCase();
    const arr = grupos.get(key) ?? [];
    arr.push(s);
    grupos.set(key, arr);
  }

  let fusionados = 0;
  for (const [, grupo] of grupos) {
    if (grupo.length <= 1) continue;
    const [canonico, ...duplicados] = grupo;
    for (const dup of duplicados) {
      await prisma.employee.updateMany({ where: { sectorId: dup.id }, data: { sectorId: canonico.id } });

      const encargados = await prisma.userSector.findMany({ where: { sectorId: dup.id } });
      for (const us of encargados) {
        const yaAsignado = await prisma.userSector.findUnique({
          where: { userId_sectorId: { userId: us.userId, sectorId: canonico.id } },
        });
        if (yaAsignado) {
          await prisma.userSector.delete({ where: { id: us.id } });
        } else {
          await prisma.userSector.update({ where: { id: us.id }, data: { sectorId: canonico.id } });
        }
      }

      await prisma.sector.delete({ where: { id: dup.id } });
      fusionados += 1;
      console.log(`Fusionado sector "${dup.nombre}" (${dup.id}) -> "${canonico.nombre}" (${canonico.id})`);
    }
  }
  console.log(`${fusionados} sectores duplicados fusionados.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
