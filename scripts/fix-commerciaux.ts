/**
 * Corrige les clients dont le commercial est encore "Administrateur"
 * en se basant sur le fichier CSV Sweet chef.
 * Usage : npx ts-node --project tsconfig.scripts.json scripts/fix-commerciaux.ts
 */
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const CSV_PATH = path.resolve(
  "C:/Users/hamza/Desktop/Sweet chef/IMPORT JANVIER/EXPORT COMPTE CLIENT-2025-12-30-11-39-35.csv"
);

function normalizeEmail(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, ".").replace(/[^a-z0-9.]/g, "") + "@sweetshef.com";
}

// Lit le CSV et retourne une map codeClient → nomCommercial
function buildCsvMap(): Map<string, string> {
  const content = fs.readFileSync(CSV_PATH, "latin1");
  const lines = content.split(/\r?\n/);
  const map = new Map<string, string>();

  let dataStarted = false;
  for (const line of lines) {
    if (!dataStarted) {
      if (line.includes("CLIENT ID") && line.includes("CODE CLIENT")) {
        dataStarted = true;
      }
      continue;
    }

    const cols = line.split(",");
    const codeClient = cols[3]?.trim() || "";
    const commercial = cols[5]?.trim() || "";

    if (codeClient && commercial) {
      map.set(codeClient, commercial);
    }
  }

  return map;
}

async function main() {
  console.log("=== Correction des commerciaux (clients assignés à Administrateur) ===\n");

  // Trouver l'admin
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) throw new Error("Aucun admin trouvé");

  // Clients encore assignés à l'admin
  const clientsAdmin = await prisma.client.findMany({
    where: { commercialId: admin.id },
    select: { id: true, codeClient: true, nom: true },
  });
  console.log(`Clients avec Administrateur comme commercial : ${clientsAdmin.length}`);

  if (clientsAdmin.length === 0) {
    console.log("Rien à corriger !");
    return;
  }

  // Lire le CSV
  const csvMap = buildCsvMap();
  console.log(`Clients dans le CSV : ${csvMap.size}\n`);

  // Récupérer ou créer les commerciaux
  const passwordHash = await bcrypt.hash("admin123", 12);
  const commercialCache = new Map<string, string>(); // name → userId

  async function getOrCreateCommercial(name: string): Promise<string | null> {
    if (!name) return null;
    if (commercialCache.has(name)) return commercialCache.get(name)!;

    const email = normalizeEmail(name);

    let user = await prisma.user.findFirst({
      where: { OR: [{ email }, { name: { equals: name, mode: "insensitive" } }] },
    });

    if (!user) {
      user = await prisma.user.create({
        data: { name, email, password: passwordHash, role: "COMMERCIAL_TERRAIN", teamType: "TERRAIN" },
      });
      console.log(`  + Nouveau commercial créé : ${name} → ${email}`);
    }

    commercialCache.set(name, user.id);
    return user.id;
  }

  let fixed = 0;
  let notInCsv = 0;
  const notFoundList: string[] = [];

  for (const client of clientsAdmin) {
    const commercialName = csvMap.get(client.codeClient);

    if (!commercialName) {
      notInCsv++;
      notFoundList.push(`${client.codeClient} — ${client.nom}`);
      continue;
    }

    const commercialId = await getOrCreateCommercial(commercialName);
    if (!commercialId) continue;

    // Mettre à jour le client
    await prisma.client.update({
      where: { id: client.id },
      data: { commercialId },
    });

    // Réattribuer ses ventes au bon commercial
    await prisma.vente.updateMany({
      where: { clientId: client.id },
      data: { commercialId },
    });

    fixed++;
  }

  console.log(`\n=== Résultat ===`);
  console.log(`  ✓ Clients corrigés : ${fixed}`);
  console.log(`  ⚠ Clients absents du CSV (restent à Administrateur) : ${notInCsv}`);

  if (notFoundList.length > 0) {
    console.log("\nClients non trouvés dans le CSV :");
    notFoundList.forEach((c) => console.log(`  - ${c}`));
  }

  // Résumé CA par commercial
  console.log("\n=== CA par commercial ===");
  const ventesParComm = await prisma.vente.groupBy({
    by: ["commercialId"],
    _sum: { montant: true },
    _count: { _all: true },
    orderBy: { _sum: { montant: "desc" } },
  });
  const comms = await prisma.user.findMany({
    where: { id: { in: ventesParComm.map((v) => v.commercialId) } },
    select: { id: true, name: true },
  });
  const commMap = Object.fromEntries(comms.map((c) => [c.id, c.name]));
  for (const v of ventesParComm) {
    const nom = commMap[v.commercialId] || "Inconnu";
    console.log(`  ${nom.padEnd(25)} → ${v._count._all} ventes, CA = ${Number(v._sum.montant || 0).toFixed(2)} €`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
