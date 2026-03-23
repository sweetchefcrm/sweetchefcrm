/**
 * Export de toute la table clients en Excel
 * Usage : npm run db:export-clients
 * Génère : exports/clients_AAAA_MM_JJ.xlsx
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Récupération de tous les clients...");

  const clients = await prisma.client.findMany({
    include: {
      commercial: { select: { name: true, email: true, role: true } },
      ventes: {
        select: { montant: true, dateVente: true },
        orderBy: { dateVente: "desc" },
      },
    },
    orderBy: { nom: "asc" },
  });

  console.log(`  ${clients.length} clients trouvés`);

  const rows = clients.map((c) => {
    const caTotal = c.ventes.reduce((sum, v) => sum + Number(v.montant), 0);
    const derniereVente = c.ventes[0]?.dateVente ?? null;

    return {
      "Code Client": c.codeClient,
      Nom: c.nom,
      "Code Postal": c.codePostal ?? "",
      Téléphone: c.telephone ?? "",
      Commercial: c.commercial.name,
      "Email Commercial": c.commercial.email,
      "Rôle Commercial": c.commercial.role.replace(/_/g, " "),
      Actif: c.actif ? "Oui" : "Non",
      Étagère: c.etagere ? "Oui" : "Non",
      "Catégorie Statut": c.categorieStatut ?? "",
      "Catégorie Type": c.categorieType ?? "",
      "CA Total (€)": caTotal,
      "Nb Factures": c.ventes.length,
      "Dernière Vente": derniereVente
        ? derniereVente.toLocaleDateString("fr-FR")
        : "",
      "Date Création": c.dateCreation.toLocaleDateString("fr-FR"),
    };
  });

  // Dossier exports
  const exportDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

  const date = new Date().toISOString().slice(0, 10); // AAAA-MM-JJ
  const outputPath = path.join(exportDir, `clients_${date}.xlsx`);

  const ws = XLSX.utils.json_to_sheet(rows);

  ws["!cols"] = [
    { wch: 14 }, // Code Client
    { wch: 35 }, // Nom
    { wch: 14 }, // Code Postal
    { wch: 16 }, // Téléphone
    { wch: 22 }, // Commercial
    { wch: 30 }, // Email Commercial
    { wch: 24 }, // Rôle Commercial
    { wch: 8  }, // Actif
    { wch: 10 }, // Étagère
    { wch: 20 }, // Catégorie Statut
    { wch: 20 }, // Catégorie Type
    { wch: 14 }, // CA Total
    { wch: 12 }, // Nb Factures
    { wch: 16 }, // Dernière Vente
    { wch: 16 }, // Date Création
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Clients");
  XLSX.writeFile(wb, outputPath);

  console.log(`\n✓ ${clients.length} clients exportés`);
  console.log(`  Fichier : ${outputPath}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
