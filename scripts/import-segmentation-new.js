/**
 * Import catégories + sous-catégories + commerciaux depuis Import/segmentation_2026-04-02.xlsx
 * Usage: node scripts/import-segmentation-new.js [--dry-run]
 */

require("dotenv").config({ path: ".env.local" });
const XLSX = require("xlsx");
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const SOURCE = "Import/segmentation_2026-04-02.xlsx";
const DRY_RUN = process.argv.includes("--dry-run");

function str(v) {
  if (v == null) return "";
  return String(v).trim();
}

async function main() {
  console.log(`=== Import Segmentation Clients ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`);

  const wb = XLSX.readFile(SOURCE);
  console.log("Feuilles:", wb.SheetNames.join(", "), "\n");

  // Users map (name lowercase → id)
  const users = await prisma.user.findMany({ select: { id: true, name: true } });
  const userMap = new Map(users.map((u) => [u.name.toLowerCase().trim(), u.id]));

  // Catégorisation sheet → cat + vendeur
  const catRows = XLSX.utils.sheet_to_json(wb.Sheets["Categorisation"]);
  const catMap = new Map();
  for (const row of catRows) {
    const code = str(row["Code Client"]);
    const cat = str(row["Categorie"]);
    const vendeur = str(row["Vendeur"]);
    if (code) catMap.set(code, { cat, vendeur });
  }
  console.log(`Categorisation : ${catMap.size} codes\n`);

  // SousCategorie depuis feuilles détail
  const detailSheets = [
    "Clients Strategiques",
    "Clients Reguliers",
    "Clients Occasionnels",
    "Clients Nouveaux",
  ];
  const sousCatMap = new Map();
  for (const name of detailSheets) {
    const ws = wb.Sheets[name];
    if (!ws) { console.warn(`Feuille "${name}" introuvable, ignorée.`); continue; }
    const rows = XLSX.utils.sheet_to_json(ws);
    let count = 0;
    for (const row of rows) {
      const code = str(row["Code Client"]);
      const sousCat = str(row["Sous-categorie"]);
      if (code && sousCat) { sousCatMap.set(code, sousCat); count++; }
    }
    console.log(`${name} : ${rows.length} lignes, ${count} sous-catégories`);
  }
  console.log(`\nTotal sous-catégories : ${sousCatMap.size}\n`);

  // Clients DB
  const dbClients = await prisma.client.findMany({
    select: { id: true, codeClient: true, nom: true, categorieStatut: true, sousCategorie: true, commercialId: true },
  });
  console.log(`Clients en base : ${dbClients.length}\n`);

  // Build updates
  const updates = [];
  let noMatch = 0;
  const vendeurNotFound = new Set();
  const changeSummary = { cat: 0, sousCat: 0, commercial: 0 };
  const examples = { cat: [], sousCat: [], commercial: [] };

  for (const client of dbClients) {
    const info = catMap.get(client.codeClient);
    if (!info) { noMatch++; continue; }

    const newCat = info.cat || null;
    const newSousCat = sousCatMap.get(client.codeClient) || null;
    const vendeurId = info.vendeur ? (userMap.get(info.vendeur.toLowerCase()) || null) : null;
    if (info.vendeur && !vendeurId) vendeurNotFound.add(info.vendeur);

    const data = {};
    if (newCat !== null && newCat !== client.categorieStatut) {
      data.categorieStatut = newCat;
      changeSummary.cat++;
      if (examples.cat.length < 5) examples.cat.push({ nom: client.nom, avant: client.categorieStatut, apres: newCat });
    }
    if (newSousCat !== client.sousCategorie) {
      data.sousCategorie = newSousCat;
      changeSummary.sousCat++;
      if (examples.sousCat.length < 5) examples.sousCat.push({ nom: client.nom, avant: client.sousCategorie, apres: newSousCat });
    }
    if (vendeurId && vendeurId !== client.commercialId) {
      data.commercialId = vendeurId;
      changeSummary.commercial++;
      const newUser = users.find((u) => u.id === vendeurId);
      const oldUser = users.find((u) => u.id === client.commercialId);
      if (examples.commercial.length < 5) examples.commercial.push({ nom: client.nom, avant: oldUser ? oldUser.name : client.commercialId, apres: newUser ? newUser.name : vendeurId });
    }

    if (Object.keys(data).length > 0) updates.push({ id: client.id, data });
  }

  console.log("=== Résumé des changements ===");
  console.log(`Clients sans correspondance fichier : ${noMatch}`);
  console.log(`Changements catégorie               : ${changeSummary.cat}`);
  console.log(`Changements sous-catégorie          : ${changeSummary.sousCat}`);
  console.log(`Changements commercial              : ${changeSummary.commercial}`);
  console.log(`Total clients à modifier            : ${updates.length}`);
  if (vendeurNotFound.size > 0) console.log(`Vendeurs non trouvés en DB          : ${[...vendeurNotFound].join(", ")}`);

  if (examples.cat.length > 0) {
    console.log("\nExemples changements catégorie:");
    examples.cat.forEach((e) => console.log(`  ${e.nom} : "${e.avant}" → "${e.apres}"`));
  }
  if (examples.sousCat.length > 0) {
    console.log("\nExemples changements sous-catégorie:");
    examples.sousCat.forEach((e) => console.log(`  ${e.nom} : "${e.avant}" → "${e.apres}"`));
  }
  if (examples.commercial.length > 0) {
    console.log("\nExemples changements commercial:");
    examples.commercial.forEach((e) => console.log(`  ${e.nom} : "${e.avant}" → "${e.apres}"`));
  }

  if (DRY_RUN) {
    console.log("\n[DRY RUN] Aucune modification appliquée.");
    return;
  }

  // Apply updates
  console.log("\nApplication des mises à jour...");
  let updated = 0;
  for (const u of updates) {
    await prisma.client.update({ where: { id: u.id }, data: u.data });
    updated++;
  }
  console.log(`\n=== Terminé : ${updated} clients mis à jour ===`);
}

main()
  .catch((e) => { console.error("Erreur:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
