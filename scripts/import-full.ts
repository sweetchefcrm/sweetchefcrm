/**
 * Import complet depuis fichiers locaux (version optimisée — batch)
 * 1. Vide ventes + clients + import_logs
 * 2. Importe factures (Export facture client 2025-2026.xlsx)
 * 3. Applique les étagères (Export etagere client.xlsx)
 * 4. Applique les codes postaux (Export client code postal vendeur.xlsx)
 *
 * Usage: npm run db:import-full
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import * as XLSX from "xlsx";
import * as path from "path";
import { PrismaClient, ImportStatus } from "@prisma/client";

const prisma = new PrismaClient();

const DOWNLOADS = "C:/Users/hamza/Downloads";
const FACTURES_FILE    = path.join(DOWNLOADS, "Export facture client 2025-2026.xlsx");
const ETAGERES_FILE    = path.join(DOWNLOADS, "Export etagere client.xlsx");
const CP_FILE          = path.join(DOWNLOADS, "Export client code postal vendeur.xlsx");
const CATEGORIES_FILE  = "C:/Users/hamza/Desktop/Sweet chef/EXPORT MARS/clients_mars_resultat.xlsx";

/** Serial Excel → Date JS */
function xlSerial(serial: number): Date {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function roundMontant(value: unknown): number {
  return Math.round((parseFloat(String(value ?? 0).replace(",", ".")) || 0) * 100) / 100;
}

/** Normalise un nom pour comparaison Jaccard */
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
  console.log("=== Import complet démarré ===\n");

  // ── Utilisateurs ──────────────────────────────────────────────────────────
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("Aucun ADMIN trouvé");

  const allUsers = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true, name: true },
  });

  const vendeurMap = new Map<string, string>(); // prénom → userId
  for (const u of allUsers) {
    const prenom = u.name.split(/\s+/)[0].toLowerCase();
    if (!vendeurMap.has(prenom)) vendeurMap.set(prenom, u.id);
  }
  console.log(`${allUsers.length} commerciaux chargés`);

  // ── 1. Nettoyage ──────────────────────────────────────────────────────────
  console.log("\nNettoyage de la base...");
  const vDel = await prisma.vente.deleteMany();
  const cDel = await prisma.client.deleteMany();
  const lDel = await prisma.importLog.deleteMany();
  console.log(`  ${vDel.count} ventes | ${cDel.count} clients | ${lDel.count} logs supprimés`);

  // ── 2. Lecture factures ───────────────────────────────────────────────────
  console.log("\nLecture du fichier factures...");
  const wb = XLSX.readFile(FACTURES_FILE);
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: null });
  console.log(`  ${rows.length} lignes lues`);

  // Extraire clients uniques ET ventes en une seule passe
  const clientMap = new Map<string, { nom: string; commercialId: string }>();
  type VenteRaw = { codeClient: string; commercialId: string; montant: number; dateVente: Date };
  const ventesRaw: VenteRaw[] = [];
  let skip = 0;

  for (const raw of rows) {
    const codeClient = String(raw["Code Client"] ?? "").trim();
    const nom        = String(raw["Client"] ?? "").trim();
    const montant    = roundMontant(raw["Total HT"]);

    if (!codeClient || !nom || montant <= 0) { skip++; continue; }

    let dateVente = new Date();
    const dr = raw["Date Facture"];
    if (typeof dr === "number" && dr > 0) dateVente = xlSerial(dr);

    // Vendeur → commercialId
    let commercialId = admin.id;
    const vr = String(raw["Vendeur"] ?? "").trim().toLowerCase();
    if (vr) {
      commercialId =
        vendeurMap.get(vr) ??
        vendeurMap.get(vr.split(/[\s.]/)[0]) ??
        admin.id;
    }

    if (!clientMap.has(codeClient)) clientMap.set(codeClient, { nom, commercialId });

    ventesRaw.push({ codeClient, commercialId, montant, dateVente });
  }

  console.log(`  ${clientMap.size} clients uniques | ${ventesRaw.length} ventes | ${skip} lignes ignorées`);

  // ── 3. Créer tous les clients en une seule requête ────────────────────────
  console.log("\nCréation des clients...");
  const clientsToCreate = [...clientMap.entries()].map(([codeClient, { nom, commercialId }]) => ({
    codeClient,
    nom,
    commercialId,
    actif: true,
  }));

  await prisma.client.createMany({ data: clientsToCreate, skipDuplicates: true });

  // Charger tous les IDs d'un coup
  const dbClients = await prisma.client.findMany({ select: { id: true, codeClient: true } });
  const clientIdMap = new Map(dbClients.map(c => [c.codeClient, c.id]));
  console.log(`  ${dbClients.length} clients créés en base`);

  // ── 4. Créer toutes les ventes en une seule requête ───────────────────────
  console.log("\nInsertion des ventes...");
  const ventesData = ventesRaw
    .map(v => ({
      clientId:     clientIdMap.get(v.codeClient)!,
      commercialId: v.commercialId,
      montant:      v.montant,
      dateVente:    v.dateVente,
      mois:         v.dateVente.getMonth() + 1,
      annee:        v.dateVente.getFullYear(),
    }))
    .filter(v => v.clientId);

  const res = await prisma.vente.createMany({ data: ventesData, skipDuplicates: true });
  console.log(`  ${res.count} ventes insérées (${ventesData.length - res.count} doublons ignorés)`);

  // Log import
  await prisma.importLog.create({
    data: {
      fileName:     "Export facture client 2025-2026.xlsx",
      fileDate:     new Date(),
      status:       ImportStatus.SUCCESS,
      rowsImported: res.count,
    },
  });

  // Statut accessible/inaccessible (6 mois)
  const ago180 = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
  const recents = await prisma.vente.findMany({
    where:    { dateVente: { gte: ago180 } },
    select:   { clientId: true },
    distinct: ["clientId"],
  });
  const idsActifs = recents.map(v => v.clientId);
  await prisma.client.updateMany({ where: { id: { notIn: idsActifs } }, data: { actif: false } });
  console.log(`  ${idsActifs.length} clients accessibles (achat < 6 mois)`);

  // ── 5. Étagères ───────────────────────────────────────────────────────────
  console.log("\nApplication des étagères...");
  const wbE = XLSX.readFile(ETAGERES_FILE);
  const rowsE = XLSX.utils.sheet_to_json<Record<string, unknown>>(wbE.Sheets[wbE.SheetNames[0]], { defval: null });

  const codesEtagere = rowsE
    .map(r => String(r["Code Client"] ?? "").trim())
    .filter(Boolean);

  const eUpdate = await prisma.client.updateMany({
    where: { codeClient: { in: codesEtagere } },
    data:  { etagere: true },
  });
  console.log(`  ${eUpdate.count}/${rowsE.length} clients avec étagère = true`);

  // ── 6. Codes postaux ──────────────────────────────────────────────────────
  console.log("\nApplication des codes postaux...");
  const wbCP = XLSX.readFile(CP_FILE);
  const rowsCP = XLSX.utils.sheet_to_json<Record<string, unknown>>(wbCP.Sheets[wbCP.SheetNames[0]], { defval: null });

  // Map nom normalisé → code postal (dédoublonné)
  const cpMap = new Map<string, string>();
  for (const r of rowsCP) {
    const soc = String(r["Société"] ?? "").trim();
    const cp  = String(r["Code Postal"] ?? "").trim();
    if (soc && cp) {
      const key = normalize(soc);
      if (key && !cpMap.has(key)) cpMap.set(key, cp);
    }
  }

  // Charger les clients et matcher
  const allClients = await prisma.client.findMany({ select: { id: true, nom: true } });

  // Grouper les mises à jour par code postal pour minimiser les requêtes
  const byCp = new Map<string, string[]>(); // cp → [id, ...]
  let cpMatched = 0;

  for (const client of allClients) {
    let best = ""; let bestScore = 0;
    for (const [normSoc, cp] of cpMap) {
      const score = jaccard(client.nom, normSoc);
      if (score > bestScore) { bestScore = score; best = cp; }
    }
    if (bestScore >= 0.4) {
      if (!byCp.has(best)) byCp.set(best, []);
      byCp.get(best)!.push(client.id);
      cpMatched++;
    }
  }

  // Un updateMany par code postal unique
  for (const [cp, ids] of byCp) {
    await prisma.client.updateMany({ where: { id: { in: ids } }, data: { codePostal: cp } });
  }
  console.log(`  ${cpMatched}/${allClients.length} clients avec code postal (${byCp.size} codes distincts)`);

  // ── 7. Catégories + type client ───────────────────────────────────────────
  console.log("\nApplication des catégories...");
  const wbCat = XLSX.readFile(CATEGORIES_FILE);
  const rowsCat = XLSX.utils.sheet_to_json<Record<string, unknown>>(wbCat.Sheets[wbCat.SheetNames[0]], { defval: null });

  // Recharger les clients avec leur nom pour le matching
  const allClientsForCat = await prisma.client.findMany({ select: { id: true, codeClient: true, nom: true } });
  const byCodeCat = new Map(allClientsForCat.map(c => [c.codeClient, c]));

  // Grouper les updates par combinaison catégorie+type pour batch
  const catBatch = new Map<string, string[]>(); // JSON(cat+type) → [clientId]
  let catDirect = 0; let catName = 0; let catNone = 0;

  for (const raw of rowsCat) {
    const code = String(raw["code_client"] ?? "").trim();
    const nom  = String(raw["nom du client"] ?? "").trim();
    const cat  = String(raw["catégorie client"] ?? "").trim() || null;
    const type = String(raw["categorie de client"] ?? "").trim() || null;
    if (!cat && !type) continue;

    let clientId: string | null = null;

    // Match direct par code
    const direct = byCodeCat.get(code);
    if (direct) { clientId = direct.id; catDirect++; }
    else {
      // Match par nom
      let best: typeof allClientsForCat[0] | null = null; let bestScore = 0;
      for (const c of allClientsForCat) {
        const score = jaccard(nom, c.nom);
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (best && bestScore >= 0.4) { clientId = best.id; catName++; }
      else { catNone++; continue; }
    }

    const key = JSON.stringify({ cat, type });
    if (!catBatch.has(key)) catBatch.set(key, []);
    catBatch.get(key)!.push(clientId);
  }

  // Dédoublonner les IDs par batch (un client ne peut être mis à jour qu'une fois)
  const seenIds = new Set<string>();
  let catUpdated = 0;
  for (const [keyStr, ids] of catBatch) {
    const { cat, type } = JSON.parse(keyStr);
    const uniqueIds = ids.filter(id => !seenIds.has(id));
    uniqueIds.forEach(id => seenIds.add(id));
    if (uniqueIds.length === 0) continue;
    const r = await prisma.client.updateMany({
      where: { id: { in: uniqueIds } },
      data: {
        ...(cat  && { categorieStatut: cat }),
        ...(type && { categorieType: type }),
      },
    });
    catUpdated += r.count;
  }
  console.log(`  Direct: ${catDirect} | Nom: ${catName} | Sans match: ${catNone}`);
  console.log(`  ${catUpdated} clients enrichis avec catégorie et type`);

  // ── Résumé ────────────────────────────────────────────────────────────────
  console.log("\n=== Import terminé ===");
  console.log(`  Clients    : ${dbClients.length}`);
  console.log(`  Ventes     : ${res.count}`);
  console.log(`  Étagères   : ${eUpdate.count}`);
  console.log(`  Code postal: ${cpMatched}`);
  console.log(`  Catégories : ${catUpdated}`);
}

main()
  .catch(e => { console.error("Erreur:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
