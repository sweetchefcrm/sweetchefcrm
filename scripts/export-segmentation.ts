/**
 * Export segmentation clients depuis la BDD → exports/segmentation_AAAA_MM_JJ.xlsx
 *
 * Même structure que Import/Segmentation_Clients.xlsx :
 *   - Clients Icham         → tous les clients
 *   - Categorisation        → tous les clients avec catégorie colorée par ligne
 *   - Resume                → tableau récapitulatif
 *   - Clients Strategiques  → stratégiques seulement (onglet doré)
 *   - Clients Reguliers     → réguliers seulement (onglet vert)
 *   - Clients Occasionnels  → occasionnels seulement (onglet bleu)
 *   - Clients Nouveaux      → nouveaux seulement (onglet violet)
 *
 * Usage : npm run db:export-segmentation
 */

import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@prisma/client";
import ExcelJS from "exceljs";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

// ── Couleurs par catégorie ────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<
  string,
  { tab: string; header: string; row: string; text: string }
> = {
  "stratégiques": {
    tab:    "FFB800",
    header: "FFB800",
    row:    "FFF3CC",
    text:   "7B4F00",
  },
  "réguliers": {
    tab:    "4CAF50",
    header: "4CAF50",
    row:    "DCEDC8",
    text:   "1B5E20",
  },
  "occasionnels": {
    tab:    "2196F3",
    header: "2196F3",
    row:    "BBDEFB",
    text:   "0D47A1",
  },
  "nouveaux": {
    tab:    "9C27B0",
    header: "9C27B0",
    row:    "E1BEE7",
    text:   "4A148C",
  },
  "perdus": {
    tab:    "F44336",
    header: "F44336",
    row:    "FFCDD2",
    text:   "B71C1C",
  },
  "prospect": {
    tab:    "9E9E9E",
    header: "9E9E9E",
    row:    "F5F5F5",
    text:   "424242",
  },
};

const DEFAULT_COLORS = {
  tab:    "607D8B",
  header: "607D8B",
  row:    "ECEFF1",
  text:   "263238",
};

function getCategoryColors(cat: string | null) {
  if (!cat) return DEFAULT_COLORS;
  return CATEGORY_COLORS[cat.toLowerCase()] ?? DEFAULT_COLORS;
}

// ── Helpers dates ─────────────────────────────────────────────────────────────
function formatDate(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function daysBetween(a: Date | null, b: Date | null): number {
  if (!a || !b) return 0;
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}

// ── Style helpers ─────────────────────────────────────────────────────────────
function applyHeaderStyle(
  row: ExcelJS.Row,
  bgColor: string,
  textColor: string
) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF" + bgColor },
    };
    cell.font = {
      bold: true,
      color: { argb: "FF" + textColor },
      name: "Calibri",
      size: 10,
    };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: false };
    cell.border = {
      top:    { style: "thin", color: { argb: "FFBDBDBD" } },
      bottom: { style: "thin", color: { argb: "FFBDBDBD" } },
      left:   { style: "thin", color: { argb: "FFBDBDBD" } },
      right:  { style: "thin", color: { argb: "FFBDBDBD" } },
    };
  });
  row.height = 20;
}

function applyDataStyle(row: ExcelJS.Row, bgColor: string, textColor: string) {
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF" + bgColor },
    };
    cell.font = {
      color: { argb: "FF" + textColor },
      name: "Calibri",
      size: 9,
    };
    cell.alignment = { vertical: "middle" };
    cell.border = {
      bottom: { style: "hair", color: { argb: "FFEEEEEE" } },
      right:  { style: "hair", color: { argb: "FFEEEEEE" } },
    };
  });
  row.height = 16;
}

// ── Freeze + AutoFilter ───────────────────────────────────────────────────────
function freezeAndFilter(ws: ExcelJS.Worksheet, colCount: number) {
  ws.views = [{ state: "frozen", xSplit: 0, ySplit: 1, activeCell: "A2" }];
  const lastCol = String.fromCharCode(64 + colCount);
  ws.autoFilter = { from: "A1", to: `${lastCol}1` };
}

// ── Largeurs de colonnes standard ────────────────────────────────────────────
function setBaseColumns(ws: ExcelJS.Worksheet) {
  ws.getColumn(1).width = 14; // Code Client
  ws.getColumn(2).width = 36; // Nom Client
  ws.getColumn(3).width = 14; // CA (HT)
  ws.getColumn(4).width = 13; // Nb Commandes
  ws.getColumn(5).width = 16; // 1ere Commande
  ws.getColumn(6).width = 18; // Derniere Commande
}

// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Export Segmentation Clients démarré ===\n");

  // ── Récupérer tous les clients avec leurs ventes ──────────────────────────
  const clients = await prisma.client.findMany({
    include: {
      commercial: { select: { name: true } },
      ventes: {
        select: { montant: true, dateVente: true },
        orderBy: { dateVente: "asc" },
      },
    },
    orderBy: { nom: "asc" },
  });

  console.log(`  ${clients.length} clients récupérés depuis la BDD\n`);

  // ── Construire les données enrichies ─────────────────────────────────────
  type ClientRow = {
    codeClient: string;
    nom: string;
    caHT: number;
    nbCommandes: number;
    premiereCommande: Date | null;
    derniereCommande: Date | null;
    intervalle: number;
    categorieStatut: string | null;
    sousCategorie: string | null;
    vendeur: string;
    panierMoyen: number;
    statut: string;
    actif: boolean;
  };

  const rows: ClientRow[] = clients.map((c) => {
    const caHT = c.ventes.reduce((s, v) => s + Number(v.montant), 0);
    const nbCommandes = c.ventes.length;
    const premiereCommande = c.ventes[0]?.dateVente ?? null;
    const derniereCommande = c.ventes[c.ventes.length - 1]?.dateVente ?? null;

    const intervalle =
      nbCommandes > 1
        ? Math.round(
            daysBetween(premiereCommande, derniereCommande) / (nbCommandes - 1)
          )
        : 0;

    const panierMoyen = nbCommandes > 0 ? caHT / nbCommandes : 0;

    return {
      codeClient: c.codeClient,
      nom: c.nom,
      caHT: Math.round(caHT * 100) / 100,
      nbCommandes,
      premiereCommande,
      derniereCommande,
      intervalle,
      categorieStatut: c.categorieStatut,
      sousCategorie: c.sousCategorie ?? null,
      vendeur: c.commercial?.name ?? "",
      panierMoyen: Math.round(panierMoyen * 100) / 100,
      statut: c.actif ? "Actif" : "Inactif",
      actif: c.actif,
    };
  });

  // ── Regrouper par catégorie ───────────────────────────────────────────────
  const strategiques = rows.filter((r) => r.categorieStatut === "stratégiques").sort((a, b) => b.caHT - a.caHT);
  const reguliers    = rows.filter((r) => r.categorieStatut === "réguliers"   ).sort((a, b) => b.caHT - a.caHT);
  const occasionnels = rows.filter((r) => r.categorieStatut === "occasionnels").sort((a, b) => b.caHT - a.caHT);
  const nouveaux     = rows.filter((r) => r.categorieStatut === "nouveaux"    ).sort((a, b) => b.caHT - a.caHT);
  const perdus       = rows.filter((r) => r.categorieStatut === "perdus"      ).sort((a, b) => b.caHT - a.caHT);
  const prospects    = rows.filter((r) => r.categorieStatut === "prospect"    ).sort((a, b) => a.nom.localeCompare(b.nom));
  const autres       = rows.filter((r) => !r.categorieStatut                   ).sort((a, b) => a.nom.localeCompare(b.nom));

  // ── CA total pour résumé ──────────────────────────────────────────────────
  const caTotal = rows.reduce((s, r) => s + r.caHT, 0);

  // ── Créer le workbook ─────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook();
  wb.creator = "CRM Icham";
  wb.created = new Date();

  // ─────────────────────────────────────────────────────────────────────────
  // FEUILLE 1 : Clients Icham (tous les clients, sans filtrage)
  // ─────────────────────────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Clients Icham", {
      properties: { tabColor: { argb: "FF607D8B" } },
    });
    setBaseColumns(ws);
    ws.getColumn(7).width = 18; // Vendeur
    ws.getColumn(8).width = 13; // Panier Moyen
    ws.getColumn(9).width = 10; // Statut

    const headers = [
      "Code Client", "Nom Client", "CA (HT)", "Nb Commandes",
      "1ere Commande", "Derniere Commande", "Vendeur", "Panier Moyen", "Statut",
    ];
    const hRow = ws.addRow(headers);
    applyHeaderStyle(hRow, "455A64", "FFFFFF");
    freezeAndFilter(ws, headers.length);

    for (const r of rows) {
      const colors = getCategoryColors(r.categorieStatut);
      const row = ws.addRow([
        r.codeClient,
        r.nom,
        r.caHT,
        r.nbCommandes,
        formatDate(r.premiereCommande),
        formatDate(r.derniereCommande),
        r.vendeur,
        r.panierMoyen,
        r.statut,
      ]);
      applyDataStyle(row, colors.row, colors.text);
      // Aligner les nombres à droite
      row.getCell(3).alignment = { horizontal: "right" };
      row.getCell(4).alignment = { horizontal: "right" };
      row.getCell(8).alignment = { horizontal: "right" };
    }
    console.log(`  Feuille "Clients Icham" : ${rows.length} lignes`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FEUILLE 2 : Categorisation (tous les clients, couleur = catégorie)
  // ─────────────────────────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Categorisation", {
      properties: { tabColor: { argb: "FF37474F" } },
    });
    setBaseColumns(ws);
    ws.getColumn(7).width = 18; // Categorie
    ws.getColumn(8).width = 18; // Vendeur
    ws.getColumn(9).width = 13; // Panier Moyen
    ws.getColumn(10).width = 10; // Statut

    const headers = [
      "Code Client", "Nom Client", "CA (HT)", "Nb Commandes",
      "1ere Commande", "Derniere Commande",
      "Categorie", "Vendeur", "Panier Moyen", "Statut",
    ];
    const hRow = ws.addRow(headers);
    applyHeaderStyle(hRow, "37474F", "FFFFFF");
    freezeAndFilter(ws, headers.length);

    // Trier : stratégiques > réguliers > occasionnels > nouveaux > perdus > prospect > autres
    const ORDER: Record<string, number> = {
      "stratégiques": 1,
      "réguliers":    2,
      "occasionnels": 3,
      "nouveaux":     4,
      "perdus":       5,
      "prospect":     6,
    };
    const sorted = [...rows].sort((a, b) => {
      const oa = ORDER[a.categorieStatut ?? ""] ?? 7;
      const ob = ORDER[b.categorieStatut ?? ""] ?? 7;
      if (oa !== ob) return oa - ob;
      return b.caHT - a.caHT;
    });

    for (const r of sorted) {
      const colors = getCategoryColors(r.categorieStatut);
      const row = ws.addRow([
        r.codeClient,
        r.nom,
        r.caHT,
        r.nbCommandes,
        formatDate(r.premiereCommande),
        formatDate(r.derniereCommande),
        r.categorieStatut ?? "",
        r.vendeur,
        r.panierMoyen,
        r.statut,
      ]);
      applyDataStyle(row, colors.row, colors.text);
      row.getCell(3).alignment = { horizontal: "right" };
      row.getCell(4).alignment = { horizontal: "right" };
      row.getCell(9).alignment = { horizontal: "right" };
      // Mettre la cellule Categorie en gras avec la couleur pleine
      const catCell = row.getCell(7);
      catCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF" + colors.header },
      };
      catCell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
        name: "Calibri",
        size: 9,
      };
      catCell.alignment = { horizontal: "center", vertical: "middle" };
    }
    console.log(`  Feuille "Categorisation" : ${sorted.length} lignes`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FEUILLE 3 : Resume — global + détail sous-catégories
  // ─────────────────────────────────────────────────────────────────────────
  {
    const ws = wb.addWorksheet("Resume", {
      properties: { tabColor: { argb: "FF263238" } },
    });
    ws.getColumn(1).width = 26; // Catégorie / Sous-catégorie
    ws.getColumn(2).width = 14; // Nb clients
    ws.getColumn(3).width = 50; // Critère / Détail

    // Données communes (sans prospects ni non catégorisés)
    const SOUS_CAT_DETAIL: Record<string, string> = {
      "Tres frequent":      "Intervalle moyen < 15 jours",
      "Mensuel":            "Intervalle moyen 15–45 jours",
      "Bimestriel":         "Intervalle moyen 45–90 jours",
      "Tres regulier":      "Commande quasi-hebdomadaire",
      "Regulier":           "Commande mensuelle régulière",
      "Fidèle":             "Historique long, fidélité éprouvée",
      "Frequent":           "Intervalles courts mais irréguliers",
      "Peu frequent":       "Commandes espacées (1–3 mois)",
      "Rare":               "Commandes très espacées (3–6 mois)",
      "Tres rare":          "1–2 commandes sur toute la période",
      "Premier achat":      "1 seule commande enregistrée",
      "Fidelisation rapide":"2–3 commandes, fidélisation en cours",
      "En developpement":   "4+ commandes, potentiel confirmé",
    };

    const ORDER_SOUS: Record<string, number> = {
      "Tres frequent": 1, "Mensuel": 2, "Bimestriel": 3,
      "Tres regulier": 1, "Fidèle": 2, "Regulier": 3,
      "Frequent": 1, "Peu frequent": 2, "Rare": 3, "Tres rare": 4,
      "En developpement": 1, "Fidelisation rapide": 2, "Premier achat": 3,
    };

    const mainGroups: Array<{
      cat: string; catKey: string; data: typeof strategiques; critere: string;
    }> = [
      { cat: "Stratégiques", catKey: "stratégiques", data: strategiques, critere: "Top clients par CA — 80% du CA total" },
      { cat: "Réguliers",    catKey: "réguliers",    data: reguliers,    critere: "Fréquence ≥ 1 commande/mois (~mensuel)" },
      { cat: "Occasionnels", catKey: "occasionnels", data: occasionnels, critere: "Actifs mais fréquence faible" },
      { cat: "Nouveaux",     catKey: "nouveaux",     data: nouveaux,     critere: "1ère commande < 3 mois" },
      { cat: "Perdus",       catKey: "perdus",       data: perdus,       critere: "Dernière commande > 6 mois" },
    ];

    // Helper : ajouter une ligne de titre de section
    function addSectionTitle(label: string) {
      const r = ws.addRow([label, "", ""]);
      r.height = 22;
      r.eachCell((cell) => {
        cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF263238" } };
        cell.font   = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 11 };
        cell.border = {
          bottom: { style: "medium", color: { argb: "FF455A64" } },
        };
      });
      r.getCell(1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    }

    // Helper : ligne de colonne (en-tête de bloc)
    function addColHeader() {
      const r = ws.addRow(["Catégorie", "Nb clients", "Critère"]);
      r.height = 18;
      r.eachCell((cell) => {
        cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF455A64" } };
        cell.font   = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 9 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      r.getCell(1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      r.getCell(3).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
    }

    // Helper : ligne vide
    function addSep(height = 8) {
      const r = ws.addRow(["", "", ""]);
      r.height = height;
      r.eachCell((cell) => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFFFFF" } };
      });
    }

    // ── BLOC 1 : Résumé global ────────────────────────────────────────────
    addSectionTitle("Résumé global");
    addColHeader();

    for (const g of mainGroups) {
      const colors = CATEGORY_COLORS[g.catKey];
      const row = ws.addRow([g.cat, g.data.length, g.critere]);
      row.height = 18;
      row.eachCell((cell) => {
        cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + colors.header } };
        cell.font   = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 10 };
        cell.border = {
          bottom: { style: "thin", color: { argb: "FFEEEEEE" } },
        };
      });
      row.getCell(1).alignment = { horizontal: "left",   vertical: "middle", indent: 1 };
      row.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
      row.getCell(3).alignment = { horizontal: "left",   vertical: "middle", indent: 1 };
    }

    // ── BLOCS sous-catégories (1 bloc par catégorie avec sous-cats) ────────
    const groupsWithSousCat = mainGroups.filter(
      (g) => g.data.some((r) => r.sousCategorie)
    );

    for (const g of groupsWithSousCat) {
      const colors = CATEGORY_COLORS[g.catKey];

      addSep(10);
      addSectionTitle(`Détail — ${g.cat}`);

      // En-tête colonnes du bloc
      const hRow = ws.addRow(["Sous-catégorie", "Nb clients", "Détail"]);
      hRow.height = 18;
      hRow.eachCell((cell) => {
        cell.fill      = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + colors.header } };
        cell.font      = { bold: true, color: { argb: "FFFFFFFF" }, name: "Calibri", size: 9 };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });
      hRow.getCell(1).alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      hRow.getCell(3).alignment = { horizontal: "left", vertical: "middle", indent: 1 };

      // Regrouper par sousCategorie
      const sousCatMap = new Map<string, number>();
      for (const r of g.data) {
        if (!r.sousCategorie) continue;
        sousCatMap.set(r.sousCategorie, (sousCatMap.get(r.sousCategorie) ?? 0) + 1);
      }

      const sortedKeys = [...sousCatMap.keys()].sort((a, b) => {
        const oa = ORDER_SOUS[a] ?? 99;
        const ob = ORDER_SOUS[b] ?? 99;
        return oa !== ob ? oa - ob : a.localeCompare(b, "fr");
      });

      for (const scKey of sortedKeys) {
        const nb     = sousCatMap.get(scKey)!;
        const detail = SOUS_CAT_DETAIL[scKey] ?? "";

        const scRow = ws.addRow([scKey, nb, detail]);
        scRow.height = 16;
        scRow.eachCell((cell) => {
          cell.fill   = { type: "pattern", pattern: "solid", fgColor: { argb: "FF" + colors.row } };
          cell.font   = { color: { argb: "FF" + colors.text }, name: "Calibri", size: 9 };
          cell.border = {
            bottom: { style: "hair", color: { argb: "FFDDDDDD" } },
            right:  { style: "hair", color: { argb: "FFDDDDDD" } },
          };
        });
        scRow.getCell(1).border = {
          left:   { style: "medium", color: { argb: "FF" + colors.header } },
          bottom: { style: "hair",   color: { argb: "FFDDDDDD" } },
        };
        scRow.getCell(1).font      = { bold: true, color: { argb: "FF" + colors.text }, name: "Calibri", size: 9 };
        scRow.getCell(1).alignment = { horizontal: "left",   vertical: "middle", indent: 2 };
        scRow.getCell(2).alignment = { horizontal: "center", vertical: "middle" };
        scRow.getCell(3).font      = { italic: true, color: { argb: "FF" + colors.text }, name: "Calibri", size: 9 };
        scRow.getCell(3).alignment = { horizontal: "left",   vertical: "middle", indent: 1 };
      }
    }

    addSep(6);
    console.log(`  Feuille "Resume" : ${mainGroups.length} catégories + ${groupsWithSousCat.length} blocs sous-catégories`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // FEUILLES détail par catégorie (Stratégiques, Réguliers, Occasionnels, Nouveaux)
  // ─────────────────────────────────────────────────────────────────────────
  const detailGroups: Array<{
    sheetName: string;
    catKey: string;
    data: typeof strategiques;
  }> = [
    { sheetName: "Clients Strategiques", catKey: "stratégiques", data: strategiques },
    { sheetName: "Clients Reguliers",    catKey: "réguliers",    data: reguliers    },
    { sheetName: "Clients Occasionnels", catKey: "occasionnels", data: occasionnels },
    { sheetName: "Clients Nouveaux",     catKey: "nouveaux",     data: nouveaux     },
  ];

  for (const g of detailGroups) {
    const colors = CATEGORY_COLORS[g.catKey] ?? DEFAULT_COLORS;
    const ws = wb.addWorksheet(g.sheetName, {
      properties: { tabColor: { argb: "FF" + colors.tab } },
    });

    setBaseColumns(ws);
    ws.getColumn(7).width = 18;  // Intervalle
    ws.getColumn(8).width = 20;  // Sous-categorie
    ws.getColumn(9).width = 18;  // Vendeur
    ws.getColumn(10).width = 13; // Panier Moyen
    ws.getColumn(11).width = 10; // Statut

    const headers = [
      "Code Client", "Nom Client", "CA (HT)", "Nb Commandes",
      "1ere Commande", "Derniere Commande",
      "Intervalle (jours)", "Sous-categorie",
      "Vendeur", "Panier Moyen", "Statut",
    ];
    const hRow = ws.addRow(headers);
    applyHeaderStyle(hRow, colors.header, "FFFFFF");
    freezeAndFilter(ws, headers.length);

    for (const r of g.data) {
      const row = ws.addRow([
        r.codeClient,
        r.nom,
        r.caHT,
        r.nbCommandes,
        formatDate(r.premiereCommande),
        formatDate(r.derniereCommande),
        r.intervalle,
        r.sousCategorie ?? "",
        r.vendeur,
        r.panierMoyen,
        r.statut,
      ]);
      applyDataStyle(row, colors.row, colors.text);
      row.getCell(3).alignment  = { horizontal: "right" };
      row.getCell(4).alignment  = { horizontal: "right" };
      row.getCell(7).alignment  = { horizontal: "center" };
      row.getCell(10).alignment = { horizontal: "right" };

      // Sous-catégorie colorée
      if (r.sousCategorie) {
        row.getCell(8).font = {
          bold: true,
          color: { argb: "FF" + colors.text },
          name: "Calibri",
          size: 9,
        };
      }
    }
    console.log(`  Feuille "${g.sheetName}" : ${g.data.length} lignes`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Sauvegarder
  // ─────────────────────────────────────────────────────────────────────────
  const exportDir = path.join(process.cwd(), "exports");
  if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

  const date = new Date().toISOString().slice(0, 10);
  const outputPath = path.join(exportDir, `segmentation_${date}.xlsx`);

  await wb.xlsx.writeFile(outputPath);

  console.log(`\n✓ Fichier généré : ${outputPath}`);
  console.log(`  ${rows.length} clients exportés\n`);
}

main()
  .catch((e) => {
    console.error("Erreur :", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
