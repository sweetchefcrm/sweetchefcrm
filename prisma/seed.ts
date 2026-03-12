/**
 * Seed minimal — crée uniquement les comptes administrateurs.
 * Les clients et ventes viennent exclusivement du Drive (import XLSX).
 * Les commerciaux viennent du script scripts/import-clients-csv.ts
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seed — création des comptes admin...");

  const hash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@crm.com" },
    update: { password: hash },
    create: {
      name: "Admin Principal",
      email: "admin@crm.com",
      password: hash,
      role: Role.ADMIN,
    },
  });
  console.log(`  ✓ ${admin.name} (${admin.email})`);

  const principal = await prisma.user.upsert({
    where: { email: "commercial.principal@crm.com" },
    update: { password: hash },
    create: {
      name: "Commercial Principal",
      email: "commercial.principal@crm.com",
      password: hash,
      role: Role.COMMERCIAL_PRINCIPAL,
    },
  });
  console.log(`  ✓ ${principal.name} (${principal.email})`);

  const aziz = await prisma.user.upsert({
    where: { email: "aziz@sweetchef.com" },
    update: { password: hash, role: Role.ADMIN },
    create: {
      name: "AZIZ",
      email: "aziz@sweetchef.com",
      password: hash,
      role: Role.ADMIN,
    },
  });
  console.log(`  ✓ ${aziz.name} (${aziz.email})`);

  const brahim = await prisma.user.upsert({
    where: { email: "brahim@sweetchef.com" },
    update: { password: hash, role: Role.ADMIN },
    create: {
      name: "BRAHIM",
      email: "brahim@sweetchef.com",
      password: hash,
      role: Role.ADMIN,
    },
  });
  console.log(`  ✓ ${brahim.name} (${brahim.email})`);

  console.log("\nSeed terminé !");
  console.log("  admin@crm.com / admin123");
  console.log("  aziz@sweetchef.com / admin123");
  console.log("  brahim@sweetchef.com / admin123");
  console.log("  commercial.principal@crm.com / admin123");
  console.log("\nPour importer les commerciaux et clients :");
  console.log("  npm run db:import-clients");
  console.log("\nPour importer les ventes depuis Google Drive :");
  console.log("  Page /admin → Synchronisation Drive");
}

main().catch(console.error).finally(() => prisma.$disconnect());
