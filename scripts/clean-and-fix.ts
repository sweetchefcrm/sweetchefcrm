/**
 * Nettoyage des données fictives du seed + réattribution des ventes aux bons commerciaux
 * Usage : npx ts-node --project tsconfig.scripts.json scripts/clean-and-fix.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const FAKE_CODES = ["CLI001", "CLI002", "CLI003", "CLI004", "CLI005", "CLI006", "CLI007", "CLI008"];
const FAKE_EMAILS = ["pierre.commercial@crm.com", "isabelle.commercial@crm.com"];

async function main() {
  console.log("=== Étape 1 : Suppression des données fictives ===\n");

  // Trouver les clients fictifs
  const fakeClients = await prisma.client.findMany({
    where: { codeClient: { in: FAKE_CODES } },
    select: { id: true, codeClient: true },
  });
  const fakeClientIds = fakeClients.map((c) => c.id);

  if (fakeClientIds.length > 0) {
    // 1. Supprimer les ventes liées aux clients fictifs (peu importe le commercial)
    const v = await prisma.vente.deleteMany({ where: { clientId: { in: fakeClientIds } } });
    console.log(`  ✓ Ventes des clients fictifs supprimées : ${v.count}`);

    // 2. Supprimer les prospects liés aux clients fictifs
    await prisma.prospect.deleteMany({ where: { clientId: { in: fakeClientIds } } });

    // 3. Supprimer les clients fictifs
    const c = await prisma.client.deleteMany({ where: { id: { in: fakeClientIds } } });
    console.log(`  ✓ Clients fictifs supprimés : ${c.count}`);
  } else {
    console.log("  - Aucun client fictif trouvé (déjà supprimés)");
  }

  // 4. Supprimer les utilisateurs fictifs
  for (const email of FAKE_EMAILS) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) { console.log(`  - ${email} déjà supprimé`); continue; }

    await prisma.vente.deleteMany({ where: { commercialId: user.id } });
    await prisma.prospect.deleteMany({ where: { commercialId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    console.log(`  ✓ Utilisateur supprimé : ${user.name}`);
  }

  console.log("\n=== Étape 2 : Réattribution des ventes aux bons commerciaux ===\n");

  // Pour chaque client, mettre à jour le commercialId de ses ventes
  const clients = await prisma.client.findMany({
    select: { id: true, commercialId: true },
  });

  let updated = 0;
  for (const client of clients) {
    const result = await prisma.vente.updateMany({
      where: { clientId: client.id, NOT: { commercialId: client.commercialId } },
      data: { commercialId: client.commercialId },
    });
    updated += result.count;
  }
  console.log(`  ✓ Ventes réattribuées : ${updated}`);

  console.log("\n=== Résultat final ===\n");

  const ventesParComm = await prisma.vente.groupBy({
    by: ["commercialId"],
    _sum: { montant: true },
    _count: { _all: true },
    orderBy: { _sum: { montant: "desc" } },
  });

  const commerciaux = await prisma.user.findMany({
    where: { id: { in: ventesParComm.map((v) => v.commercialId) } },
    select: { id: true, name: true },
  });
  const commMap = Object.fromEntries(commerciaux.map((c) => [c.id, c.name]));

  for (const v of ventesParComm) {
    const nom = commMap[v.commercialId] || "Inconnu";
    console.log(`  ${nom.padEnd(25)} → ${v._count._all} ventes, CA = ${Number(v._sum.montant || 0).toFixed(2)} €`);
  }

  const total = await prisma.vente.aggregate({ _sum: { montant: true }, _count: true });
  console.log(`\n  TOTAL : ${total._count} ventes — CA = ${Number(total._sum.montant || 0).toFixed(2)} €`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
