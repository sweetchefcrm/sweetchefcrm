/**
 * Export des commerciaux en Excel
 * Usage : npm run db:export-commerciaux
 * Génère : exports/commerciaux.xlsx
 */
import { PrismaClient, Role } from "@prisma/client";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

const COMMERCIAL_ROLES: Role[] = [
  Role.COMMERCIAL_TERRAIN,
  Role.COMMERCIAL_TELEVENTE,
  Role.CHEF_TERRAIN,
  Role.CHEF_TELEVENTE,
  Role.COMMERCIAL_PRINCIPAL,
];

async function main() {
  console.log("Récupération des commerciaux...");

  const commerciaux = await prisma.user.findMany({
    where: { role: { in: COMMERCIAL_ROLES } },
    orderBy: [{ role: "asc" }, { name: "asc" }],
  });

  if (commerciaux.length === 0) {
    console.log("Aucun commercial trouvé en base.");
    return;
  }

  // Enrichir avec le nombre de clients et ventes
  const enriched = await Promise.all(
    commerciaux.map(async (user) => {
      const [nbClients, nbClientsActifs, caTotal] = await Promise.all([
        prisma.client.count({ where: { commercialId: user.id } }),
        prisma.client.count({ where: { commercialId: user.id, actif: true } }),
        prisma.vente.aggregate({
          where: { commercialId: user.id },
          _sum: { montant: true },
        }),
      ]);
      return {
        Nom: user.name,
        Email: user.email,
        Rôle: user.role.replace(/_/g, " "),
        Équipe: user.teamType ?? "—",
        "Nb Clients Total": nbClients,
        "Nb Clients Actifs": nbClientsActifs,
        "CA Total (€)": Number(caTotal._sum.montant || 0),
        "Créé le": user.createdAt.toLocaleDateString("fr-FR"),
      };
    })
  );

  // Créer le dossier exports s'il n'existe pas
  const exportDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

  const outputPath = path.join(exportDir, "commerciaux.xlsx");

  const ws = XLSX.utils.json_to_sheet(enriched);

  // Largeurs de colonnes
  ws["!cols"] = [
    { wch: 25 }, // Nom
    { wch: 35 }, // Email
    { wch: 25 }, // Rôle
    { wch: 12 }, // Équipe
    { wch: 18 }, // Nb Clients Total
    { wch: 18 }, // Nb Clients Actifs
    { wch: 16 }, // CA Total
    { wch: 14 }, // Créé le
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Commerciaux");
  XLSX.writeFile(wb, outputPath);

  console.log(`\n✓ ${commerciaux.length} commerciaux exportés`);
  console.log(`  Fichier : ${outputPath}\n`);

  // Résumé console
  for (const c of enriched) {
    console.log(`  ${c.Nom.padEnd(25)} ${c.Rôle.padEnd(25)} ${c["Nb Clients Total"]} clients`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
