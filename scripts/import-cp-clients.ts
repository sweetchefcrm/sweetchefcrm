/**
 * Import codes postaux depuis Import/clients_code_postal.xlsx
 *
 * Jointure par Code Client (correspondance directe).
 * Met à jour uniquement les clients dont le code postal est différent ou manquant.
 *
 * Usage: npm run db:import-cp
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as XLSX from "xlsx";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const SOURCE = path.join(process.cwd(), "Import", "clients_code_postal.xlsx");

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** Détecte le nom de colonne parmi plusieurs variantes */
function findCol(headers: string[], candidates: string[]): string | null {
  const normalized = headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const c of candidates) {
    const idx = normalized.indexOf(c.toLowerCase().replace(/[^a-z0-9]/g, ""));
    if (idx !== -1) return headers[idx];
  }
  return null;
}

async function main() {
  console.log(`\n📂 Lecture du fichier : ${SOURCE}\n`);

  const wb = XLSX.readFile(SOURCE);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

  if (rows.length === 0) {
    console.error("❌ Fichier vide ou non lisible");
    process.exit(1);
  }

  const headers = Object.keys(rows[0]);
  console.log(`   Colonnes détectées : ${headers.join(", ")}`);

  const codeClientCol = findCol(headers, [
    "codeclient", "code client", "code_client", "client code", "code",
  ]);
  const codePostalCol = findCol(headers, [
    "codepostal", "code postal", "code_postal", "cp", "ville", "zipcode", "zip",
  ]);

  if (!codeClientCol) {
    console.error("❌ Colonne Code Client introuvable. Colonnes disponibles :", headers.join(", "));
    process.exit(1);
  }
  if (!codePostalCol) {
    console.error("❌ Colonne Code Postal introuvable. Colonnes disponibles :", headers.join(", "));
    process.exit(1);
  }

  console.log(`   Code Client → "${codeClientCol}"`);
  console.log(`   Code Postal → "${codePostalCol}"\n`);

  // Construire un map codeClient → codePostal depuis le fichier
  // On stocke la clé sous deux formes : brute et zéro-paddée à 6 chiffres
  const cpMap = new Map<string, string>();
  for (const row of rows) {
    const raw = str(row[codeClientCol]);
    const cp = str(row[codePostalCol]);
    if (!raw) continue;
    // Forme brute (ex: "C2024-0075")
    cpMap.set(raw, cp);
    // Si purement numérique, aussi en version zéro-paddée à 6 chiffres (ex: "519" → "000519")
    if (/^\d+$/.test(raw)) {
      cpMap.set(raw.padStart(6, "0"), cp);
    }
  }

  console.log(`   ${cpMap.size} entrées dans le fichier\n`);

  // Récupérer tous les clients concernés
  const clients = await prisma.client.findMany({
    select: { id: true, codeClient: true, codePostal: true },
  });

  let updated = 0;
  let unchanged = 0;
  let notFound = 0;

  const updates: Promise<unknown>[] = [];

  for (const client of clients) {
    const newCp = cpMap.get(client.codeClient);
    if (newCp === undefined) {
      notFound++;
      continue;
    }
    const cpValue = newCp || null;
    if (cpValue === client.codePostal) {
      unchanged++;
    } else {
      updates.push(
        prisma.client.update({
          where: { id: client.id },
          data: { codePostal: cpValue },
        })
      );
      updated++;
    }
  }

  if (updates.length > 0) {
    await Promise.all(updates);
  }

  console.log("✅ Import terminé !\n");
  console.log(`   ✏️  Codes postaux modifiés   : ${updated}`);
  console.log(`   ✔️  Déjà corrects (inchangés) : ${unchanged}`);
  console.log(`   ⚠️  Clients absents du fichier: ${notFound}`);
  console.log(`   📋 Total clients en base      : ${clients.length}\n`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  prisma.$disconnect();
  process.exit(1);
});
