import * as dotenv from "dotenv";
import * as path from "path";

// Charger .env.local en priorité
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

import { PrismaClient } from "@prisma/client";
import { google } from "googleapis";
import * as XLSX from "xlsx";
import * as fs from "fs";

const prisma = new PrismaClient();

// ── Parser XLSX ──────────────────────────────────────────────────────────────
function extractDateFromFilename(filename: string): Date | null {
  const match = filename.match(/export_(\d{4})_(\d{2})_(\d{2})\.xlsx/i);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(`${year}-${month}-${day}`);
}

function parseXlsxBuffer(buffer: Buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  console.log("\n📋 Colonnes détectées dans le fichier Excel :");
  const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
  const headers: string[] = [];
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cell = sheet[XLSX.utils.encode_cell({ r: 0, c: C })];
    headers.push(cell ? String(cell.v) : `COL_${C}`);
  }
  console.log(headers.join(" | "));

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  console.log(`\n📊 Nombre de lignes : ${rawRows.length}`);
  if (rawRows.length > 0) {
    console.log("Exemple ligne 1 :", JSON.stringify(rawRows[0], null, 2));
  }

  return { rawRows, headers };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("🗑️  Suppression des données de test...");

  await prisma.vente.deleteMany({});
  await prisma.prospect.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.importLog.deleteMany({});
  await prisma.user.deleteMany({});

  console.log("✅ Base de données vidée.\n");

  // Connexion Google Drive
  console.log("🔗 Connexion à Google Drive...");
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!keyJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY manquante dans .env.local");

  const key = JSON.parse(keyJson);
  const auth = new google.auth.GoogleAuth({
    credentials: key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });

  const drive = google.drive({ version: "v3", auth });
  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_FOLDER_ID manquante");

  // Lister les fichiers
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
    orderBy: "name desc",
  });

  const files = res.data.files || [];
  console.log(`\n📁 Fichiers trouvés dans Drive (${files.length}) :`);
  files.forEach((f) => console.log(`   - ${f.name} (${f.mimeType})`));

  const xlsxFiles = files.filter(
    (f) =>
      f.name?.match(/\.xlsx$/i) ||
      f.mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );

  if (xlsxFiles.length === 0) {
    console.log("\n⚠️  Aucun fichier .xlsx trouvé dans le dossier Drive.");
    console.log("Le dossier est peut-être vide ou le nom ne correspond pas.");
    return;
  }

  // Prendre le fichier le plus récent
  const file = xlsxFiles[0];
  console.log(`\n📥 Téléchargement de : ${file.name}`);

  const fileRes = await drive.files.get(
    { fileId: file.id!, alt: "media" },
    { responseType: "arraybuffer" }
  );

  const buffer = Buffer.from(fileRes.data as ArrayBuffer);
  const { rawRows, headers } = parseXlsxBuffer(buffer);

  console.log(
    "\n⚠️  ANALYSE TERMINÉE — Le fichier a été lu mais pas encore importé."
  );
  console.log(
    "Vérifiez les colonnes ci-dessus et dites-moi les noms exacts de vos colonnes"
  );
  console.log(
    "pour que je configure l'import correctement.\n"
  );
}

main()
  .catch((e) => {
    console.error("❌ Erreur :", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
