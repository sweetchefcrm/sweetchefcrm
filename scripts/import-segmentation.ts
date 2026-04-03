/**
 * Import catégories + sous-catégories depuis Import/Segmentation_Clients.xlsx
 *
 * Feuilles utilisées :
 *   - Categorisation         → categorieStatut (Categorie)
 *   - Clients Strategiques   → sousCategorie
 *   - Clients Reguliers      → sousCategorie
 *   - Clients Occasionnels   → sousCategorie
 *   - Clients Nouveaux       → sousCategorie
 *
 * Jointure par Code Client (correspondance directe).
 *
 * Usage: npm run db:import-segmentation
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as XLSX from "xlsx";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE = path.join(process.cwd(), "Import", "Segmentation_Clients.xlsx");

function str(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

const CATEGORIE_NORMALIZE: Record<string, string> = {
  "strategique":        "stratégiques",
  "strategiques":       "stratégiques",
  "clients strategiques": "stratégiques",
  "regulier":           "réguliers",
  "reguliers":          "réguliers",
  "clients reguliers":  "réguliers",
  "occasionnel":        "occasionnels",
  "occasionnels":       "occasionnels",
  "clients occasionnels": "occasionnels",
  "nouveau":            "nouveaux",
  "nouveaux":           "nouveaux",
  "clients nouveaux":   "nouveaux",
  "perdu":              "perdus",
  "perdus":             "perdus",
  "clients perdus":     "perdus",
  "prospect":           "prospect",
  "prospects":          "prospect",
};

function normalizeCategorie(raw: string): string {
  const key = raw.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  for (const [k, v] of Object.entries(CATEGORIE_NORMALIZE)) {
    const kNorm = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (key === kNorm) return v;
  }
  return raw; // garder tel quel si inconnu
}

async function main() {
  console.log("=== Import Segmentation Clients démarré ===\n");

  // ── Lire le fichier Excel ────────────────────────────────────────────────────
  const wb = XLSX.readFile(SOURCE);
  console.log("Feuilles :", wb.SheetNames.join(", "), "\n");

  // ── Feuille Categorisation → categorieStatut ─────────────────────────────────
  const catSheet = wb.Sheets["Categorisation"];
  if (!catSheet) {
    console.error('Feuille "Categorisation" introuvable !');
    process.exit(1);
  }
  const catRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(catSheet, { defval: null });
  console.log(`Categorisation : ${catRows.length} lignes`);

  // Map codeClient → categorieStatut
  const catMap = new Map<string, string>();
  for (const row of catRows) {
    const code = str(row["Code Client"]);
    const categorie = str(row["Categorie"]);
    if (code && categorie) catMap.set(code, normalizeCategorie(categorie));
  }
  console.log(`  → ${catMap.size} codes avec catégorie\n`);

  // ── Feuilles détail → sousCategorie ──────────────────────────────────────────
  const detailSheets = [
    "Clients Strategiques",
    "Clients Reguliers",
    "Clients Occasionnels",
    "Clients Nouveaux",
  ];

  const sousCatMap = new Map<string, string>();
  for (const sheetName of detailSheets) {
    const ws = wb.Sheets[sheetName];
    if (!ws) {
      console.warn(`Feuille "${sheetName}" introuvable, ignorée.`);
      continue;
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
    let count = 0;
    for (const row of rows) {
      const code = str(row["Code Client"]);
      const sousCat = str(row["Sous-categorie"]);
      if (code && sousCat) {
        sousCatMap.set(code, sousCat);
        count++;
      }
    }
    console.log(`${sheetName} : ${rows.length} lignes → ${count} sous-catégories`);
  }
  console.log(`\nTotal codes avec sous-catégorie : ${sousCatMap.size}\n`);

  // ── Charger tous les clients DB ──────────────────────────────────────────────
  const dbClients = await prisma.client.findMany({
    select: { id: true, codeClient: true },
  });
  console.log(`Clients en base : ${dbClients.length}\n`);

  // ── Construire les mises à jour ──────────────────────────────────────────────
  type Update = {
    id: string;
    categorieStatut: string | null;
    sousCategorie: string | null;
  };

  const updates: Update[] = [];
  let matchCat = 0;
  let matchSousCat = 0;
  let noMatch = 0;

  for (const client of dbClients) {
    const code = client.codeClient;
    const cat = catMap.get(code) ?? null;
    const sousCat = sousCatMap.get(code) ?? null;

    if (cat || sousCat) {
      updates.push({ id: client.id, categorieStatut: cat, sousCategorie: sousCat });
      if (cat) matchCat++;
      if (sousCat) matchSousCat++;
    } else {
      noMatch++;
    }
  }

  console.log(`Clients avec catégorie      : ${matchCat}`);
  console.log(`Clients avec sous-catégorie : ${matchSousCat}`);
  console.log(`Clients sans correspondance : ${noMatch}`);
  console.log(`Total à mettre à jour       : ${updates.length}\n`);

  if (updates.length === 0) {
    console.log("Rien à mettre à jour. Vérifier les codes clients.");
    return;
  }

  // ── Appliquer en batch par valeur unique ─────────────────────────────────────
  type BatchKey = string;
  const batchMap = new Map<BatchKey, string[]>();

  for (const u of updates) {
    const key: BatchKey = JSON.stringify({
      categorieStatut: u.categorieStatut,
      sousCategorie: u.sousCategorie,
    });
    if (!batchMap.has(key)) batchMap.set(key, []);
    batchMap.get(key)!.push(u.id);
  }

  let totalUpdated = 0;
  for (const [keyStr, ids] of batchMap) {
    const { categorieStatut, sousCategorie } = JSON.parse(keyStr);
    const data: Record<string, string | null> = {};
    if (categorieStatut !== null) data.categorieStatut = categorieStatut;
    if (sousCategorie !== null) data.sousCategorie = sousCategorie;
    if (Object.keys(data).length === 0) continue;

    const r = await prisma.client.updateMany({
      where: { id: { in: ids } },
      data,
    });
    totalUpdated += r.count;
  }

  console.log(`=== Terminé : ${totalUpdated} clients mis à jour ===`);
}

main()
  .catch((e) => {
    console.error("Erreur:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
