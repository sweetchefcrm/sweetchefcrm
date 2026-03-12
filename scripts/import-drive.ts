import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient, Role, ImportStatus } from "@prisma/client";
import { google } from "googleapis";
import * as XLSX from "xlsx";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("👤 Création du compte administrateur...");

  const hash = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.upsert({
    where: { email: "admin@crm.com" },
    update: {},
    create: {
      name: "Administrateur",
      email: "admin@crm.com",
      password: hash,
      role: Role.ADMIN,
    },
  });

  console.log(`✅ Admin créé : admin@crm.com / admin123\n`);

  // Connexion Google Drive
  console.log("🔗 Connexion à Google Drive...");
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY manquante");

  const key = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const drive = google.drive({ version: "v3", auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID manquante");

  // Lister tous les fichiers xlsx
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType, createdTime)",
    orderBy: "name desc",
  });

  const files = (res.data.files || []).filter(
    (f) =>
      f.name?.match(/\.xlsx$/i) ||
      f.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  console.log(`📁 ${files.length} fichier(s) xlsx trouvé(s)\n`);

  let totalImported = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const file of files) {
    const fileName = file.name!;

    // Vérifier si déjà importé
    const existing = await prisma.importLog.findUnique({ where: { fileName } });
    if (existing) {
      console.log(`⏭️  Déjà importé : ${fileName}`);
      totalSkipped++;
      continue;
    }

    console.log(`📥 Import de : ${fileName}`);

    try {
      const fileRes = await drive.files.get(
        { fileId: file.id!, alt: "media" },
        { responseType: "arraybuffer" }
      );

      const buffer = Buffer.from(fileRes.data as ArrayBuffer);
      const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

      // Extraire la date depuis le nom de fichier (ex: "Export 23.02.xlsx" → 23/02/2026)
      let fileDate = new Date();
      const matchFr = fileName.match(/(\d{1,2})[._-](\d{2})(?:[._-](\d{2,4}))?/);
      if (matchFr) {
        const day = parseInt(matchFr[1]);
        const month = parseInt(matchFr[2]) - 1;
        const year = matchFr[3]
          ? (matchFr[3].length === 2 ? 2000 + parseInt(matchFr[3]) : parseInt(matchFr[3]))
          : new Date().getFullYear();
        fileDate = new Date(year, month, day);
      }

      let rowsImported = 0;
      let rowsError = 0;

      for (const raw of rawRows) {
        try {
          const codeClient = String(raw["Code Client"] || raw["code_client"] || "").trim();
          const nom = String(raw["Client"] || raw["client"] || raw["nom_client"] || "").trim();
          const montantRaw = raw["Total HT"] ?? raw["Total TTC"] ?? raw["montant"] ?? 0;
          const montant = parseFloat(String(montantRaw).replace(",", ".")) || 0;

          let dateVente = fileDate;
          const dateRaw = raw["Date Cde"] ?? raw["date_vente"] ?? raw["Date"];
          if (dateRaw instanceof Date && !isNaN(dateRaw.getTime())) {
            dateVente = dateRaw;
          } else if (typeof dateRaw === "string" && dateRaw) {
            const parsed = new Date(dateRaw);
            if (!isNaN(parsed.getTime())) dateVente = parsed;
          }

          dateVente.setHours(0, 0, 0, 0);

          if (!codeClient || !nom || montant <= 0) {
            rowsError++;
            continue;
          }

          // UPSERT client
          const client = await prisma.client.upsert({
            where: { codeClient },
            update: { nom, actif: true },
            create: {
              codeClient,
              nom,
              commercialId: admin.id,
              actif: true,
            },
          });

          // UPSERT vente anti-doublon
          await prisma.vente.upsert({
            where: {
              clientId_dateVente_montant: {
                clientId: client.id,
                dateVente,
                montant,
              },
            },
            update: {},
            create: {
              clientId: client.id,
              commercialId: admin.id,
              montant,
              dateVente,
              mois: dateVente.getMonth() + 1,
              annee: dateVente.getFullYear(),
            },
          });

          rowsImported++;
        } catch {
          rowsError++;
        }
      }

      await prisma.importLog.create({
        data: {
          fileName,
          fileDate,
          status: ImportStatus.SUCCESS,
          rowsImported,
        },
      });

      console.log(`   ✅ ${rowsImported} vente(s) importée(s), ${rowsError} ignorée(s)`);
      totalImported++;

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.importLog.create({
        data: {
          fileName,
          fileDate: new Date(),
          status: ImportStatus.ERROR,
          errorMessage: msg,
        },
      });
      console.log(`   ❌ Erreur : ${msg}`);
      totalErrors++;
    }
  }

  // Mettre à jour le statut actif des clients (>60 jours = inactif)
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const clientsAvecVenteRecente = await prisma.vente.findMany({
    where: { dateVente: { gte: sixtyDaysAgo } },
    select: { clientId: true },
    distinct: ["clientId"],
  });
  const idsActifs = clientsAvecVenteRecente.map((v) => v.clientId);
  await prisma.client.updateMany({
    where: { id: { notIn: idsActifs } },
    data: { actif: false },
  });

  console.log(`\n🎉 Import terminé !`);
  console.log(`   Fichiers importés : ${totalImported}`);
  console.log(`   Fichiers ignorés  : ${totalSkipped}`);
  console.log(`   Erreurs           : ${totalErrors}`);

  // Statistiques finales
  const [nbClients, nbVentes] = await Promise.all([
    prisma.client.count(),
    prisma.vente.count(),
  ]);
  console.log(`\n📊 Base de données :`);
  console.log(`   ${nbClients} clients`);
  console.log(`   ${nbVentes} ventes`);
  console.log(`\n🔑 Connexion : admin@crm.com / admin123`);
}

main()
  .catch((e) => { console.error("❌ Erreur :", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
