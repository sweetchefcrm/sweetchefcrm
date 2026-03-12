import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const [nbUsers, nbClients, nbVentes, nbProspects] = await Promise.all([
    prisma.user.count(),
    prisma.client.count(),
    prisma.vente.count(),
    prisma.prospect.count(),
  ]);

  console.log("=== État de la base de données ===");
  console.log(`Utilisateurs : ${nbUsers}`);
  console.log(`Clients      : ${nbClients}`);
  console.log(`Ventes       : ${nbVentes}`);
  console.log(`Prospects    : ${nbProspects}`);

  // Ventes par mois (12 derniers mois)
  const ventesParMois = await prisma.vente.groupBy({
    by: ["mois", "annee"],
    _sum: { montant: true },
    _count: { _all: true },
    orderBy: [{ annee: "desc" }, { mois: "desc" }],
    take: 12,
  });

  console.log("\n=== Ventes par mois (plus récents) ===");
  for (const v of ventesParMois) {
    console.log(`  ${String(v.mois).padStart(2, "0")}/${v.annee} → ${v._count._all} ventes, CA = ${Number(v._sum.montant || 0).toFixed(2)} €`);
  }

  // Ventes par commercial
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

  console.log("\n=== CA par commercial ===");
  for (const v of ventesParComm) {
    const nom = commMap[v.commercialId] || v.commercialId;
    console.log(`  ${nom.padEnd(25)} → ${v._count._all} ventes, CA = ${Number(v._sum.montant || 0).toFixed(2)} €`);
  }

  // Vérifier doublons éventuels
  const total = await prisma.vente.aggregate({ _sum: { montant: true } });
  console.log(`\n=== CA TOTAL en base : ${Number(total._sum.montant || 0).toFixed(2)} €`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
