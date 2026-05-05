import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role, ImportStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";

/** Serial Excel → Date JS */
function xlSerial(serial: number): Date {
  const d = new Date(Date.UTC(1899, 11, 30) + serial * 86400000);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function roundMontant(value: unknown): number {
  return Math.round(Math.abs(parseFloat(String(value ?? 0).replace(",", ".")) || 0) * 100) / 100;
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Aucun fichier fourni" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
    wb.Sheets[wb.SheetNames[0]],
    { defval: null }
  );

  if (rows.length === 0) {
    return NextResponse.json({ error: "Fichier vide" }, { status: 400 });
  }

  // Charger utilisateurs pour matching Vendeur → id
  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) return NextResponse.json({ error: "Admin introuvable" }, { status: 500 });

  const allUsers = await prisma.user.findMany({
    where: { role: { not: "ADMIN" } },
    select: { id: true, name: true },
  });
  const vendeurMap = new Map<string, string>();
  for (const u of allUsers) {
    const prenom = u.name.split(/\s+/)[0].toLowerCase();
    if (!vendeurMap.has(prenom)) vendeurMap.set(prenom, u.id);
  }

  // Créer le log d'import
  const importLog = await prisma.avoirImportLog.create({
    data: {
      fileName: file.name,
      status: ImportStatus.SUCCESS,
      rowsImported: 0,
    },
  });

  // Charger tous les clients pour matching
  const allClients = await prisma.client.findMany({
    select: { id: true, codeClient: true },
  });
  const clientByCode = new Map(allClients.map((c) => [c.codeClient, c.id]));

  type AvoirData = {
    clientId: string;
    commercialId: string;
    montant: number;
    dateAvoir: Date;
    mois: number;
    annee: number;
    importBatchId: string;
  };

  const avoirsData: AvoirData[] = [];
  let skip = 0;

  for (const raw of rows) {
    const codeClient = String(raw["Code Client"] ?? "").trim();
    const montant = roundMontant(raw["Total HT"]);

    if (!codeClient || montant <= 0) { skip++; continue; }

    const clientId = clientByCode.get(codeClient);
    if (!clientId) { skip++; continue; }

    // Date : essayer plusieurs noms de colonne
    let dateAvoir = new Date();
    const dateRaw =
      raw["Date Avoir"] ??
      raw["Date Facture"] ??
      raw["Date"] ??
      raw["date"];
    if (typeof dateRaw === "number" && dateRaw > 0) {
      dateAvoir = xlSerial(dateRaw);
    }

    // Vendeur → commercialId
    let commercialId = admin.id;
    const vr = String(raw["Vendeur"] ?? "").trim().toLowerCase();
    if (vr) {
      commercialId =
        vendeurMap.get(vr) ??
        vendeurMap.get(vr.split(/[\s.]/)[0]) ??
        admin.id;
    }

    avoirsData.push({
      clientId,
      commercialId,
      montant,
      dateAvoir,
      mois: dateAvoir.getMonth() + 1,
      annee: dateAvoir.getFullYear(),
      importBatchId: importLog.id,
    });
  }

  let imported = 0;
  if (avoirsData.length > 0) {
    const result = await prisma.avoir.createMany({
      data: avoirsData,
      skipDuplicates: false,
    });
    imported = result.count;
  }

  // Mettre à jour le log avec le vrai nombre de lignes importées
  await prisma.avoirImportLog.update({
    where: { id: importLog.id },
    data: { rowsImported: imported },
  });

  return NextResponse.json({
    success: true,
    imported,
    skipped: skip,
    logId: importLog.id,
  });
}
