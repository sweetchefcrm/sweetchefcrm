/**
 * Export Merch TV Réguliers
 * Pour chaque commercial du planning, liste les clients réguliers télévente
 * qui sont dans son territoire mais assignés à un commercial télévente.
 *
 * Génère : exports/merch_tv_reguliers_AAAA-MM-JJ.xlsx
 * Usage  : npm run db:export-merch-tv-reguliers
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { PLANNING, isInTerritory } from "../lib/planning-config";

const prisma = new PrismaClient();

async function main() {
  console.log("══════════════════════════════════════════════════");
  console.log("  Export Merch TV — Clients Réguliers Télévente");
  console.log("══════════════════════════════════════════════════\n");

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, teamType: true },
  });

  const findUser = (dbName: string) =>
    allUsers.find((u) => u.name.toLowerCase() === dbName.toLowerCase()) ?? null;

  const allClients = await prisma.client.findMany({
    select: {
      codeClient: true,
      nom: true,
      telephone: true,
      codePostal: true,
      categorieStatut: true,
      commercialId: true,
      commercial: { select: { id: true, name: true, teamType: true } },
    },
  });

  console.log(`  ${allClients.length} clients chargés\n`);

  const wb = XLSX.utils.book_new();

  // ── Feuille récapitulatif ────────────────────────────────────────────────
  const summaryAoa: (string | number)[][] = [
    ["Commercial", "Départements", "Nb clients stratégiques TV dans le secteur"],
  ];

  const perCommercial: {
    entry: typeof PLANNING[number];
    clients: {
      codeClient: string;
      nom: string;
      telephone: string | null;
      codePostal: string | null;
      commercialTV: string;
    }[];
  }[] = [];

  for (const entry of PLANNING) {
    const user = findUser(entry.dbName);
    if (!user) {
      console.warn(`  ⚠ ${entry.displayName} (${entry.dbName}) introuvable en base`);
    }

    const territory = allClients.filter((c) =>
      isInTerritory(c.codePostal, entry.departements, entry.belgique)
    );

    // Clients réguliers + stratégiques télévente dans le territoire, pas assignés à ce commercial
    const merchClients = territory
      .filter(
        (c) =>
          c.categorieStatut === "stratégiques" &&
          c.commercial.teamType === "TELEVENTE" &&
          (!user || c.commercialId !== user.id)
      )
      .map((c) => ({
        codeClient: c.codeClient,
        nom: c.nom,
        telephone: c.telephone,
        codePostal: c.codePostal,
        commercialTV: c.commercial.name,
      }))
      .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

    perCommercial.push({ entry, clients: merchClients });

    const deptLabel = [
      ...entry.departements,
      ...(entry.belgique ? ["Belgique"] : []),
    ].join(", ");

    summaryAoa.push([entry.displayName, deptLabel, merchClients.length]);

    console.log(
      `  ${entry.displayName.padEnd(12)} → ${String(merchClients.length).padStart(3)} clients stratégiques TV`
    );
  }

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary["!cols"] = [{ wch: 16 }, { wch: 40 }, { wch: 38 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, "Récapitulatif");

  // ── Une feuille par commercial ───────────────────────────────────────────
  for (const { entry, clients } of perCommercial) {
    if (clients.length === 0) continue;

    const sheetAoa: (string | number | null)[][] = [
      [`Merch TV Stratégiques — ${entry.displayName} (${clients.length} client${clients.length > 1 ? "s" : ""})`],
      [],
      ["Code Client", "Nom", "Code Postal", "Téléphone", "Commercial TV"],
    ];

    for (const c of clients) {
      sheetAoa.push([
        c.codeClient,
        c.nom,
        c.codePostal ?? "",
        c.telephone ?? "",
        c.commercialTV,
      ]);
    }

    const ws = XLSX.utils.aoa_to_sheet(sheetAoa);
    ws["!cols"] = [
      { wch: 14 },
      { wch: 38 },
      { wch: 13 },
      { wch: 18 },
      { wch: 18 },
    ];
    // Fusionner le titre sur les 5 colonnes
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }];

    XLSX.utils.book_append_sheet(wb, ws, entry.displayName);
  }

  // ── Écriture du fichier ──────────────────────────────────────────────────
  const exportDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

  const date = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(exportDir, `merch_tv_reguliers_${date}.xlsx`);

  XLSX.writeFile(wb, outputPath);
  console.log(`\n✓ Fichier généré : ${outputPath}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
