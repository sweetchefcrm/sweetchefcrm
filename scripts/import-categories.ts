/**
 * Import des catégories clients depuis clients_export_trim.xlsx
 * Col 0  = code_client
 * Col 11 = catégorie client (statut fidélité)
 * Col 12 = categorie de client (type métier)
 *
 * Usage : npm run db:import-categories
 */

import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXCEL_PATH = path.resolve(
  "C:/Users/hamza/Desktop/Sweet chef/EXPORT MARS/clients_export_trim.xlsx"
);

function normalizeCategory(value: unknown): string | null {
  const str = String(value ?? "").trim();
  if (!str || str.toLowerCase() === "nan" || str === "None") return null;
  return str;
}

async function main() {
  console.log("=== Import catégories clients ===\n");

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error(`Fichier introuvable : ${EXCEL_PATH}`);
    process.exit(1);
  }

  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  // header: 1 → tableau de tableaux (pas d'objet)
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });

  // Ignorer la ligne d'en-tête (ligne 0)
  const dataRows = rows.slice(1);
  console.log(`${dataRows.length} lignes à traiter\n`);

  let updated = 0;
  let notFound = 0;
  let skipped = 0;

  for (const row of dataRows) {
    if (!Array.isArray(row)) continue;

    const codeClient = String(row[0] ?? "").trim();
    if (!codeClient || codeClient.toLowerCase() === "nan") {
      skipped++;
      continue;
    }

    const categorieStatut = normalizeCategory(row[11]);
    const categorieType = normalizeCategory(row[12]);

    const result = await prisma.client.updateMany({
      where: { codeClient },
      data: { categorieStatut, categorieType },
    });

    if (result.count === 0) {
      notFound++;
    } else {
      updated++;
    }
  }

  console.log("=== Résultat ===");
  console.log(`  Mis à jour   : ${updated}`);
  console.log(`  Introuvables : ${notFound}`);
  console.log(`  Ignorés      : ${skipped}`);
}

main()
  .catch((err) => {
    console.error("Erreur critique :", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
