import * as XLSX from "xlsx";

export interface ExcelRow {
  code_client: string;
  nom_client: string;
  ville?: string;
  telephone?: string;
  commercial_email: string;
  montant: number;
  date_vente: Date;
}

export function parseXlsxBuffer(buffer: Buffer): ExcelRow[] {
  const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: null,
  });

  const rows: ExcelRow[] = [];

  for (const raw of rawRows) {
    const codeClient = String(raw["code_client"] || raw["CODE_CLIENT"] || raw["Code Client"] || "").trim();
    const nomClient = String(raw["nom_client"] || raw["NOM_CLIENT"] || raw["Nom Client"] || raw["nom"] || "").trim();
    const commercialEmail = String(raw["commercial_email"] || raw["COMMERCIAL_EMAIL"] || raw["Email Commercial"] || "").trim().toLowerCase();
    const montantRaw = raw["montant"] || raw["MONTANT"] || raw["Montant"] || 0;
    const montant = parseFloat(String(montantRaw).replace(",", ".")) || 0;

    let dateVente: Date;
    const dateRaw = raw["date_vente"] || raw["DATE_VENTE"] || raw["Date"] || raw["date"];
    if (dateRaw instanceof Date) {
      dateVente = dateRaw;
    } else if (typeof dateRaw === "string" || typeof dateRaw === "number") {
      dateVente = new Date(dateRaw);
    } else {
      dateVente = new Date();
    }

    if (!codeClient || !nomClient || !commercialEmail || isNaN(dateVente.getTime())) {
      continue; // Ignorer les lignes invalides
    }

    rows.push({
      code_client: codeClient,
      nom_client: nomClient,
      ville: String(raw["ville"] || raw["VILLE"] || raw["Ville"] || "").trim() || undefined,
      telephone: String(raw["telephone"] || raw["TELEPHONE"] || raw["Tel"] || "").trim() || undefined,
      commercial_email: commercialEmail,
      montant,
      date_vente: dateVente,
    });
  }

  return rows;
}

export function extractDateFromFilename(filename: string): Date | null {
  // Format: export_AAAA_MM_JJ.xlsx
  const match = filename.match(/export_(\d{4})_(\d{2})_(\d{2})\.xlsx/i);
  if (!match) return null;
  const [, year, month, day] = match;
  return new Date(`${year}-${month}-${day}`);
}
