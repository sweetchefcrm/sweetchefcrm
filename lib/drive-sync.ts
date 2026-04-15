import { google } from "googleapis";
import * as XLSX from "xlsx";
import prisma from "./prisma";
import { ImportStatus } from "@prisma/client";

// Guard contre les syncs concurrentes
let isSyncing = false;

function getGoogleAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY manquante");
  const key = JSON.parse(keyJson);
  return new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
}

function extractDateFromFilename(filename: string): Date {
  const matchFr = filename.match(/(\d{1,2})[._-](\d{2})(?:[._-](\d{2,4}))?/);
  if (matchFr) {
    const day = parseInt(matchFr[1]);
    const month = parseInt(matchFr[2]) - 1;
    const year = matchFr[3]
      ? matchFr[3].length === 2
        ? 2000 + parseInt(matchFr[3])
        : parseInt(matchFr[3])
      : new Date().getFullYear();
    return new Date(year, month, day);
  }
  return new Date();
}

/** Convertit un serial Excel (numérique) en Date JS */
function xlSerialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
}

function roundMontant(value: unknown): number {
  const parsed = parseFloat(String(value ?? 0).replace(",", ".")) || 0;
  return Math.round(parsed * 100) / 100;
}

export async function syncDriveFiles(): Promise<{
  imported: number;
  skipped: number;
  errors: number;
}> {
  if (isSyncing) throw new Error("Synchronisation déjà en cours, veuillez patienter.");
  isSyncing = true;

  try {
    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
    if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID manquante");

    const auth = getGoogleAuth();
    const drive = google.drive({ version: "v3", auth });

    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "files(id, name, mimeType)",
      orderBy: "name desc",
    });

    const files = (res.data.files || []).filter(
      (f) =>
        f.name?.match(/\.xlsx$/i) ||
        f.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    let imported = 0;
    let skipped = 0;
    let errors = 0;

    const adminUser = await prisma.user.findFirst({ where: { role: "ADMIN" } });
    if (!adminUser) throw new Error("Aucun utilisateur ADMIN trouvé en base");

    // Charger tous les utilisateurs pour matcher par prénom (vendeur)
    const allUsers = await prisma.user.findMany({
      where: { role: { not: "ADMIN" } },
      select: { id: true, name: true },
    });

    // Map prénom (lowercase) → userId
    const vendeurMap = new Map<string, string>();
    for (const u of allUsers) {
      const prenom = u.name.split(/\s+/)[0].toLowerCase();
      if (!vendeurMap.has(prenom)) vendeurMap.set(prenom, u.id);
    }

    for (const file of files) {
      const fileName = file.name!;

      const existing = await prisma.importLog.findUnique({ where: { fileName } });
      if (existing) {
        skipped++;
        continue;
      }

      const fileDate = extractDateFromFilename(fileName);

      try {
        const fileRes = await drive.files.get(
          { fileId: file.id!, alt: "media" },
          { responseType: "arraybuffer" }
        );

        const buffer = Buffer.from(fileRes.data as ArrayBuffer);
        const workbook = XLSX.read(buffer, { type: "buffer", cellDates: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

        if (rawRows.length === 0) {
          await prisma.importLog.create({
            data: { fileName, fileDate, status: ImportStatus.SKIPPED, errorMessage: "Fichier vide" },
          });
          skipped++;
          continue;
        }

        const ventesData: {
          clientId: string;
          commercialId: string;
          montant: number;
          dateVente: Date;
          mois: number;
          annee: number;
        }[] = [];

        let rowsImported = 0;

        for (const raw of rawRows) {
          // Support nouveau format factures ET ancien format commandes
          const codeClient = String(
            raw["Code Client"] ?? raw["code_client"] ?? ""
          ).trim();
          const nom = String(
            raw["Client"] ?? raw["nom_client"] ?? ""
          ).trim();
          const montant = roundMontant(
            raw["Total HT"] ?? raw["Total TTC"] ?? raw["montant"]
          );

          if (!codeClient || !nom || montant <= 0) continue;

          // Date : serial Excel (factures) ou Date JS (commandes)
          let dateVente = new Date(fileDate);
          const dateRaw = raw["Date Facture"] ?? raw["Date Cde"] ?? raw["date_vente"] ?? raw["Date"];
          if (typeof dateRaw === "number" && dateRaw > 0) {
            dateVente = xlSerialToDate(dateRaw);
          } else if (dateRaw instanceof Date && !isNaN(dateRaw.getTime())) {
            dateVente = new Date(dateRaw);
          } else if (typeof dateRaw === "string" && dateRaw) {
            const parsed = new Date(dateRaw);
            if (!isNaN(parsed.getTime())) dateVente = parsed;
          }
          dateVente.setHours(0, 0, 0, 0);

          // Vendeur : par prénom (factures) ou email (ancien)
          let commercialId = adminUser.id;
          const vendeurRaw = raw["Vendeur"] ?? raw["commercial_email"];
          if (vendeurRaw) {
            const vendeurStr = String(vendeurRaw).trim().toLowerCase();
            // Cherche d'abord par prénom exact, puis par prénom partiel
            const byPrenom = vendeurMap.get(vendeurStr);
            if (byPrenom) {
              commercialId = byPrenom;
            } else {
              // Essaie avec le prénom (avant espace ou point)
              const prenom = vendeurStr.split(/[\s.]/)[0];
              commercialId = vendeurMap.get(prenom) ?? adminUser.id;
            }
          }

          // Catégories (ancien format commandes)
          const rawStatut = raw["catégorie client"] ?? raw["categorie_client"] ?? null;
          const rawType = raw["categorie de client"] ?? raw["categorie_type"] ?? null;
          const categorieStatut = rawStatut && String(rawStatut).toLowerCase() !== "nan" ? String(rawStatut).trim() : undefined;
          const categorieType = rawType && String(rawType).toLowerCase() !== "nan" ? String(rawType).trim() : undefined;

          // Ne pas écraser le commercialId existant si le vendeur n'a pas été reconnu (= admin)
          const vendeurReconnu = commercialId !== adminUser.id;
          const client = await prisma.client.upsert({
            where: { codeClient },
            update: {
              nom,
              actif: true,
              ...(vendeurReconnu && { commercialId }),
              ...(categorieStatut !== undefined && { categorieStatut }),
              ...(categorieType !== undefined && { categorieType }),
            },
            create: {
              codeClient,
              nom,
              commercialId,
              actif: true,
              categorieStatut: categorieStatut ?? null,
              categorieType: categorieType ?? null,
            },
          });

          ventesData.push({
            clientId: client.id,
            commercialId,
            montant,
            dateVente,
            mois: dateVente.getMonth() + 1,
            annee: dateVente.getFullYear(),
          });

          rowsImported++;
        }

        // Créer le log en premier pour obtenir son ID (utilisé comme batchId sur les ventes)
        const importLog = await prisma.importLog.create({
          data: { fileName, fileDate, status: ImportStatus.SUCCESS, rowsImported },
        });

        if (ventesData.length > 0) {
          await prisma.vente.createMany({
            data: ventesData.map((v) => ({ ...v, importBatchId: importLog.id })),
            skipDuplicates: true,
          });
        }

        // Mettre à jour statut accessible/inaccessible (6 mois)
        const sixMonthsAgo = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        const recents = await prisma.vente.findMany({
          where: { dateVente: { gte: sixMonthsAgo } },
          select: { clientId: true },
          distinct: ["clientId"],
        });
        const idsActifs = recents.map((v) => v.clientId);
        await prisma.client.updateMany({ where: { id: { notIn: idsActifs } }, data: { actif: false } });

        imported++;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await prisma.importLog.create({
          data: { fileName, fileDate, status: ImportStatus.ERROR, errorMessage: message },
        });
        errors++;
      }
    }

    return { imported, skipped, errors };
  } finally {
    isSyncing = false;
  }
}
