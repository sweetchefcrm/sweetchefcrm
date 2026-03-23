/**
 * Import catégories depuis clients_mars_resultat1.xlsx
 * Remplace les catégories de chaque client correspondant.
 *
 * Usage: npm run db:import-categories-mars1
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as XLSX from "xlsx";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SOURCE = path.join(
  "C:/Users/hamza/Desktop/Sweet chef/EXPORT MARS",
  "clients_mars_resultat1.xlsx"
);

function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/\b(sarl|sas|sasu|snc|eurl|sci|pro|sa|les|des|de|du|le|la|l|d|the)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ").trim();
}

function jaccard(a: string, b: string): number {
  const ta = new Set(normalize(a).split(" ").filter(t => t.length > 2));
  const tb = new Set(normalize(b).split(" ").filter(t => t.length > 2));
  if (!ta.size || !tb.size) return 0;
  const inter = [...ta].filter(x => tb.has(x)).length;
  return inter / (ta.size + tb.size - inter);
}

async function main() {
  console.log("=== Import catégories (mars1) démarré ===\n");

  // ── Lire le fichier ──────────────────────────────────────────────────────────
  const wb = XLSX.readFile(SOURCE);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  console.log(`${rows.length} lignes dans le fichier`);

  // Afficher les colonnes détectées (aide au debug)
  if (rows.length > 0) {
    console.log("Colonnes détectées :", Object.keys(rows[0]).join(", "), "\n");
  }

  // ── Charger tous les clients DB ──────────────────────────────────────────────
  const dbClients = await prisma.client.findMany({
    select: { id: true, codeClient: true, nom: true },
  });
  const byCode = new Map(dbClients.map(c => [c.codeClient, c]));
  console.log(`${dbClients.length} clients en base\n`);

  // ── Construire les mises à jour ──────────────────────────────────────────────
  type Update = { id: string; categorieStatut: string | null; categorieType: string | null };
  const updates: Update[] = [];
  let directMatch = 0;
  let nameMatch = 0;
  let noMatch = 0;

  for (const raw of rows) {
    // Essayer plusieurs variantes de noms de colonnes
    const code = String(
      raw["code_client"] ?? raw["Code Client"] ?? raw["CODE CLIENT"] ?? ""
    ).trim();
    const nom = String(
      raw["nom du client"] ?? raw["Nom du client"] ?? raw["NOM DU CLIENT"] ?? raw["Client"] ?? raw["client"] ?? ""
    ).trim();
    const cat = String(
      raw["catégorie client"] ?? raw["Catégorie client"] ?? raw["CATEGORIE CLIENT"] ??
      raw["categorie client"] ?? raw["Categorie Client"] ?? ""
    ).trim() || null;
    const type = String(
      raw["categorie de client"] ?? raw["Catégorie de client"] ?? raw["CATEGORIE DE CLIENT"] ??
      raw["type client"] ?? raw["Type Client"] ?? ""
    ).trim() || null;

    if (!cat && !type) continue;

    let client = byCode.get(code) ?? null;

    if (client) {
      directMatch++;
    } else if (nom) {
      // Match par nom (Jaccard)
      let best: typeof dbClients[0] | null = null;
      let bestScore = 0;
      for (const c of dbClients) {
        const score = jaccard(nom, c.nom);
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (best && bestScore >= 0.4) {
        client = best;
        nameMatch++;
      } else {
        noMatch++;
        continue;
      }
    } else {
      noMatch++;
      continue;
    }

    updates.push({ id: client.id, categorieStatut: cat, categorieType: type });
  }

  console.log(`Match direct (code)  : ${directMatch}`);
  console.log(`Match par nom        : ${nameMatch}`);
  console.log(`Aucun match          : ${noMatch}`);
  console.log(`Total à mettre à jour: ${updates.length}\n`);

  if (updates.length === 0) {
    console.log("Rien à mettre à jour. Vérifier les noms de colonnes ci-dessus.");
    return;
  }

  // ── Appliquer en batch ───────────────────────────────────────────────────────
  type Key = string;
  const batchMap = new Map<Key, string[]>();

  for (const u of updates) {
    const key: Key = JSON.stringify({ categorieStatut: u.categorieStatut, categorieType: u.categorieType });
    if (!batchMap.has(key)) batchMap.set(key, []);
    batchMap.get(key)!.push(u.id);
  }

  let totalUpdated = 0;
  for (const [keyStr, ids] of batchMap) {
    const { categorieStatut, categorieType } = JSON.parse(keyStr);
    const r = await prisma.client.updateMany({
      where: { id: { in: ids } },
      data: {
        ...(categorieStatut !== null && { categorieStatut }),
        ...(categorieType   !== null && { categorieType }),
      },
    });
    totalUpdated += r.count;
  }

  console.log(`=== Terminé : ${totalUpdated} clients mis à jour ===`);
}

main()
  .catch(e => { console.error("Erreur:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
