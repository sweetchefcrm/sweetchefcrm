/**
 * Import des clients depuis le CSV Sweet chef
 * Usage : npx ts-node --compiler-options {"module":"CommonJS"} scripts/import-clients-csv.ts
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient, Role, TeamType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Chemin vers le CSV — adapter si besoin
const CSV_PATH = path.resolve(
  "C:/Users/hamza/Desktop/Sweet chef/IMPORT JANVIER/EXPORT COMPTE CLIENT-2025-12-30-11-39-35.csv"
);

function normalizeCommercialName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "");
}

function parseCSV(filePath: string): Array<{
  clientId: string;
  codeClient: string;
  nom: string;
  commercial: string;
  categorie: string;
  blackliste: boolean;
  actif: boolean;
}> {
  const content = fs.readFileSync(filePath, "latin1");
  const lines = content.split(/\r?\n/);

  // Trouver la ligne d'en-tête (contient "CLIENT ID")
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes("CLIENT ID") && lines[i].includes("CODE CLIENT")) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) {
    throw new Error("En-tête CSV introuvable (CLIENT ID, CODE CLIENT)");
  }

  const rows: ReturnType<typeof parseCSV> = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line === ",,,,,,,,") continue;

    // Découpage CSV (séparateur virgule, premier champ vide)
    const cols = line.split(",");
    // Format: ,CLIENT_ID,,CODE_CLIENT,NOM,COMMERCIAL,CATEGORIE,BLACKLIST,ACTIF
    //          0    1   2     3        4       5          6          7      8

    const clientId = cols[1]?.trim() || "";
    const codeClient = cols[3]?.trim() || "";
    const nom = cols[4]?.trim() || "";
    const commercial = cols[5]?.trim() || "";
    const categorie = cols[6]?.trim() || "";
    const blackliste = cols[7]?.trim() === "1";
    const actif = cols[8]?.trim() === "1";

    if (!codeClient || !nom || !commercial) continue;
    // Ignorer si le commercial est vide ou "Evomunio" (compte système)
    if (commercial === "") continue;

    rows.push({ clientId, codeClient, nom, commercial, categorie, blackliste, actif });
  }

  return rows;
}

async function main() {
  console.log("=== Import clients depuis CSV Sweet chef ===\n");

  const rows = parseCSV(CSV_PATH);
  console.log(`${rows.length} lignes trouvées dans le CSV\n`);

  // --- 1. Extraire les noms uniques de commerciaux ---
  const uniqueCommercials = [...new Set(rows.map((r) => r.commercial))].filter(Boolean);
  console.log(`${uniqueCommercials.length} commerciaux uniques : ${uniqueCommercials.join(", ")}\n`);

  // --- 2. Créer / trouver chaque commercial ---
  const passwordHash = await bcrypt.hash("password123", 12);
  const commercialMap: Record<string, string> = {}; // nom → userId

  for (const name of uniqueCommercials) {
    const emailNorm = normalizeCommercialName(name);
    const email = `${emailNorm}@sweetshef.com`;

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { name: { equals: name, mode: "insensitive" } }],
      },
    });

    if (existing) {
      commercialMap[name] = existing.id;
      console.log(`  ✓ Commercial existant : ${name} → ${existing.email}`);
    } else {
      const created = await prisma.user.create({
        data: {
          name,
          email,
          password: passwordHash,
          role: Role.COMMERCIAL_TERRAIN,
          teamType: TeamType.TERRAIN,
        },
      });
      commercialMap[name] = created.id;
      console.log(`  + Créé : ${name} → ${email}`);
    }
  }

  console.log();

  // --- 3. Importer les clients ---
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const commercialId = commercialMap[row.commercial];
    if (!commercialId) {
      console.warn(`  ⚠ Commercial introuvable pour "${row.commercial}" (client ${row.codeClient})`);
      skipped++;
      continue;
    }

    try {
      const existing = await prisma.client.findUnique({
        where: { codeClient: row.codeClient },
      });

      if (existing) {
        await prisma.client.update({
          where: { codeClient: row.codeClient },
          data: {
            nom: row.nom,
            actif: row.actif,
            commercialId,
          },
        });
        updated++;
      } else {
        await prisma.client.create({
          data: {
            codeClient: row.codeClient,
            nom: row.nom,
            actif: row.actif,
            commercialId,
          },
        });
        created++;
      }
    } catch (err) {
      console.error(`  ✗ Erreur client ${row.codeClient}:`, err);
      skipped++;
    }
  }

  console.log("\n=== Résultat ===");
  console.log(`  Clients créés   : ${created}`);
  console.log(`  Clients mis à jour : ${updated}`);
  console.log(`  Ignorés/erreurs : ${skipped}`);
  console.log(`\nComptes créés (mot de passe : password123) :`);
  for (const [name, id] of Object.entries(commercialMap)) {
    const emailNorm = normalizeCommercialName(name);
    console.log(`  ${name.padEnd(15)} → ${emailNorm}@sweetshef.com`);
  }
}

main()
  .catch((err) => {
    console.error("Erreur critique :", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
