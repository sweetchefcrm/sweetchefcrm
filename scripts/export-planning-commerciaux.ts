/**
 * Export Planning Emploi du Temps Commerciaux
 * Pour chaque commercial et ses départements, calcule :
 *  - Groupe A   : ses clients stratégiques dans le territoire
 *  - Groupe B   : ses clients réguliers dans le territoire
 *  - Merch TV   : clients stratégiques TV dans le territoire (pas les siens)
 *  - Merch Ilyasse : clients d'Ilyasse dans le territoire
 * Génère : exports/planning_commerciaux_AAAA_MM_JJ.xlsx
 * Usage  : npm run db:planning
 */
import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface PlanningEntry {
  displayName: string;  // Nom affiché dans l'Excel
  dbName: string;       // Prénom dans la DB (insensible à la casse)
  departements: string[]; // Codes département (2 chiffres)
  belgique: boolean;    // Inclure les clients belges (CP 4 chiffres)
  joursDispo: number;   // Jours terrain disponibles par mois
}

const PLANNING: PlanningEntry[] = [
  {
    displayName: "Fadoua",
    dbName: "fadoua",
    departements: ["59", "62", "80"],
    belgique: true,
    joursDispo: 21,
  },
  {
    displayName: "Hamza",
    dbName: "hamza",
    departements: ["75", "77", "93", "94", "60"],
    belgique: false,
    joursDispo: 21,
  },
  {
    displayName: "Maissa",
    dbName: "maissa",
    departements: ["91", "92", "95", "78", "27", "76"],
    belgique: false,
    joursDispo: 21,
  },
  {
    displayName: "Zouhair",
    dbName: "zouhair",
    departements: ["09", "12", "31", "32", "33", "47", "81", "82", "66", "11"],
    belgique: false,
    joursDispo: 21,
  },
  {
    displayName: "Jassim",
    dbName: "moha",
    departements: ["06", "13", "83"],
    belgique: false,
    joursDispo: 15,
  },
  {
    displayName: "Taha",
    dbName: "taha taha",
    departements: ["01", "38", "42", "69", "73", "74"],
    belgique: false,
    joursDispo: 15,
  },
  {
    displayName: "Anas",
    dbName: "anas",
    departements: ["30", "34", "84", "26"],
    belgique: false,
    joursDispo: 15,
  },
];

/**
 * Vérifie si un code postal appartient au territoire d'un commercial.
 * - France : les 2 premiers chiffres = département (code à 5 chiffres)
 * - Belgique : code à 4 chiffres commençant par 1-9
 */
function isInTerritory(
  codePostal: string | null,
  departements: string[],
  belgique: boolean
): boolean {
  if (!codePostal) return false;
  const cp = codePostal.trim().replace(/\s+/g, "");

  // Belgique : 4 chiffres, commence par 1-9 (distingue des depts français 0X)
  if (belgique && /^[1-9]\d{3}$/.test(cp)) return true;

  // France : les 2 premiers chars = département
  for (const dept of departements) {
    if (cp.startsWith(dept) && cp.length >= 4) return true;
  }
  return false;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function main() {
  console.log("══════════════════════════════════════════════════");
  console.log("  Planning Emploi du Temps Commerciaux");
  console.log("══════════════════════════════════════════════════\n");

  // ── Charger tous les utilisateurs ─────────────────────────────────────────
  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, role: true, teamType: true },
  });

  const findUser = (dbName: string) =>
    allUsers.find((u) => u.name.toLowerCase() === dbName.toLowerCase());

  const ilyasse = findUser("ilyasse");
  if (!ilyasse) {
    console.warn("  ⚠ Ilyasse introuvable en base — colonne Merch Ilyasse sera 0");
  }

  // ── Charger tous les clients (une seule requête) ───────────────────────────
  const allClients = await prisma.client.findMany({
    select: {
      codePostal: true,
      categorieStatut: true,
      commercialId: true,
      commercial: { select: { id: true, name: true, teamType: true } },
    },
  });

  console.log(`  ${allClients.length} clients chargés en mémoire\n`);

  // ── Construire le tableau AOA (array of arrays) pour l'Excel ──────────────
  const headerRow = [
    "Commerciaux",
    "",
    "Clients Groupe A (stratégiques)",
    "Clients Groupe B (réguliers, visite 1 mois sur 2)",
    "Merch Clients Groupe A (stratégiques) TV / secteur",
    "Merch Clients ILYASSE / secteur",
    "Jours restants libres",
  ];

  const aoa: (string | number)[][] = [headerRow];

  console.log(
    "  " +
      "Commercial".padEnd(12) +
      "GrA".padStart(5) +
      "GrB".padStart(5) +
      "MerchTV".padStart(9) +
      "MerchI".padStart(8) +
      " | Jours utilisés / dispo"
  );
  console.log("  " + "─".repeat(60));

  for (const entry of PLANNING) {
    const user = findUser(entry.dbName);
    if (!user) {
      console.warn(`  ⚠ ${entry.displayName} (${entry.dbName}) introuvable en base`);
    }

    // Clients dans le territoire de ce commercial
    const territory = allClients.filter((c) =>
      isInTerritory(c.codePostal, entry.departements, entry.belgique)
    );

    // Groupe A : ses propres clients stratégiques
    const nbA = territory.filter(
      (c) =>
        user &&
        c.commercialId === user.id &&
        c.categorieStatut === "stratégiques"
    ).length;

    // Groupe B : ses propres clients réguliers
    const nbB = territory.filter(
      (c) =>
        user &&
        c.commercialId === user.id &&
        c.categorieStatut === "réguliers"
    ).length;

    // Merch TV : clients stratégiques dans le territoire, commercial = TELEVENTE, pas les siens
    const nbMerchTV = territory.filter(
      (c) =>
        c.categorieStatut === "stratégiques" &&
        c.commercial.teamType === "TELEVENTE" &&
        (!user || c.commercialId !== user.id)
    ).length;

    // Merch Ilyasse : clients d'Ilyasse dans le territoire
    const nbMerchIlyasse = ilyasse
      ? territory.filter((c) => c.commercialId === ilyasse.id).length
      : 0;

    // Jours (÷ 5 clients/jour)
    const joursA = round2(nbA / 5);
    const joursB = round2(nbB / 5);
    const joursMTV = round2(nbMerchTV / 5);
    const joursMI = round2(nbMerchIlyasse / 5);
    const totalJours = round2(joursA + joursB + joursMTV + joursMI);
    const joursLibres = round2(entry.joursDispo - totalJours);

    // Label colonne A : "Fadoua  59  62  80  Belgique"
    const deptLabel = [
      ...entry.departements,
      ...(entry.belgique ? ["Belgique"] : []),
    ].join("  ");
    const rowLabel = `${entry.displayName}  ${deptLabel}`;

    // Ligne 1 : Nombres
    aoa.push([rowLabel, "Nombres", nbA, nbB, nbMerchTV, nbMerchIlyasse, joursLibres]);
    // Ligne 2 : Jours accordés
    aoa.push([entry.joursDispo, "Jours accordés", joursA, joursB, joursMTV, joursMI, ""]);
    // Ligne vide séparatrice
    aoa.push([]);

    console.log(
      `  ${entry.displayName.padEnd(12)}` +
        `${String(nbA).padStart(5)}` +
        `${String(nbB).padStart(5)}` +
        `${String(nbMerchTV).padStart(9)}` +
        `${String(nbMerchIlyasse).padStart(8)}` +
        ` | ${totalJours}j utilisés / ${entry.joursDispo}j dispo (${joursLibres}j libres)`
    );
  }

  // ── Export Excel ──────────────────────────────────────────────────────────
  const exportDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

  const date = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(exportDir, `planning_commerciaux_${date}.xlsx`);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Largeur des colonnes
  ws["!cols"] = [
    { wch: 48 }, // Commerciaux + depts
    { wch: 16 }, // Nombres / Jours accordés
    { wch: 28 }, // Groupe A
    { wch: 36 }, // Groupe B
    { wch: 38 }, // Merch TV
    { wch: 26 }, // Merch Ilyasse
    { wch: 20 }, // Jours libres
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Planning");
  XLSX.writeFile(wb, outputPath);

  console.log(`\n✓ Fichier généré : ${outputPath}\n`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
