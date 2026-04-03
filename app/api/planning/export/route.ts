import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { PLANNING, isInTerritory, round2 } from "@/lib/planning-config";
import ExcelJS from "exceljs";

const ADMIN_ROLES: Role[] = [
  Role.ADMIN,
  Role.COMMERCIAL_PRINCIPAL,
  Role.CHEF_TERRAIN,
  Role.CHEF_TELEVENTE,
];

type ClientRow = {
  id: string;
  codeClient: string;
  nom: string;
  telephone: string | null;
  codePostal: string | null;
  categorieStatut: string | null;
  commercialId: string;
  commercial: { id: string; name: string; teamType: string | null };
};

function writeSection(
  ws: ExcelJS.Worksheet,
  title: string,
  clients: ClientRow[],
  headerColor: string,
  lightColor: string,
  startRow: number
): number {
  if (clients.length === 0) return startRow;

  // Section title
  ws.mergeCells(`A${startRow}:E${startRow}`);
  const sectionCell = ws.getCell(`A${startRow}`);
  sectionCell.value = `${title}  (${clients.length} client${clients.length > 1 ? "s" : ""})`;
  sectionCell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
  sectionCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: headerColor } };
  sectionCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(startRow).height = 22;
  startRow++;

  // Column headers
  const headers = ["Code Client", "Nom", "Code Postal", "Téléphone", "Catégorie"];
  const hRow = ws.getRow(startRow);
  headers.forEach((h, i) => {
    const cell = hRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: lightColor } };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD1D5DB" } } };
    cell.alignment = { horizontal: "center" };
  });
  ws.getRow(startRow).height = 16;
  startRow++;

  // Data
  const sorted = [...clients].sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  for (const c of sorted) {
    const row = ws.getRow(startRow);
    row.getCell(1).value = c.codeClient;
    row.getCell(2).value = c.nom;
    row.getCell(3).value = c.codePostal ?? "";
    row.getCell(4).value = c.telephone ?? "";
    row.getCell(5).value = c.categorieStatut ?? "";
    row.getCell(1).font = { size: 9 };
    row.getCell(2).font = { size: 9 };
    row.getCell(3).font = { size: 9 };
    row.getCell(4).font = { size: 9, color: { argb: "FF1E40AF" } };
    row.getCell(5).font = { size: 9, color: { argb: "FF6B7280" }, italic: true };
    startRow++;
  }

  // Blank separator
  startRow++;
  return startRow;
}

export async function GET(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = session.user.role as Role;
  if (!ADMIN_ROLES.includes(role))
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, teamType: true },
  });

  const allClients = await prisma.client.findMany({
    select: {
      id: true,
      codeClient: true,
      nom: true,
      telephone: true,
      codePostal: true,
      categorieStatut: true,
      commercialId: true,
      commercial: { select: { id: true, name: true, teamType: true } },
    },
  });

  const ilyasse = allUsers.find((u) => u.name.toLowerCase() === "ilyasse") ?? null;

  const wb = new ExcelJS.Workbook();
  wb.creator = "CRM Commercial";
  wb.created = new Date();

  // Summary sheet
  const wsSummary = wb.addWorksheet("Récapitulatif");
  wsSummary.columns = [
    { key: "name", width: 18 },
    { key: "depts", width: 30 },
    { key: "A", width: 14 },
    { key: "B", width: 14 },
    { key: "nouveaux", width: 12 },
    { key: "merchTV", width: 14 },
    { key: "ilyasse", width: 14 },
    { key: "total", width: 12 },
    { key: "dispo", width: 12 },
    { key: "libres", width: 12 },
  ];

  // Summary header
  wsSummary.mergeCells("A1:J1");
  const sumTitle = wsSummary.getCell("A1");
  sumTitle.value = `Planning Terrain — Export du ${new Date().toLocaleDateString("fr-FR")}`;
  sumTitle.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  sumTitle.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
  sumTitle.alignment = { horizontal: "center", vertical: "middle" };
  wsSummary.getRow(1).height = 30;

  const sumHeaders = [
    "Commercial", "Départements", "Stratégiques (A)", "Réguliers (B)",
    "Nouveaux", "Merch TV", "Merch Ilyasse", "Total jours", "Jours dispo", "Jours libres",
  ];
  const sumHRow = wsSummary.getRow(2);
  sumHeaders.forEach((h, i) => {
    const cell = sumHRow.getCell(i + 1);
    cell.value = h;
    cell.font = { bold: true, size: 9 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDBEAFE" } };
    cell.border = { bottom: { style: "thin", color: { argb: "FF93C5FD" } } };
    cell.alignment = { horizontal: "center" };
  });
  wsSummary.getRow(2).height = 18;

  let sumRow = 3;

  for (const entry of PLANNING) {
    const user = allUsers.find((u) => u.name.toLowerCase() === entry.dbName.toLowerCase());
    if (!user) continue;

    const territory = allClients.filter((c) =>
      isInTerritory(c.codePostal, entry.departements, entry.belgique)
    );

    const clientsA = territory.filter(
      (c) => c.commercialId === user.id && c.categorieStatut === "stratégiques"
    );
    const clientsB = territory.filter(
      (c) => c.commercialId === user.id && c.categorieStatut === "réguliers"
    );
    const clientsNouveaux = territory.filter(
      (c) => c.commercialId === user.id && c.categorieStatut === "nouveaux"
    );
    const clientsMerchTV = territory.filter(
      (c) =>
        c.categorieStatut === "stratégiques" &&
        c.commercial.teamType === "TELEVENTE" &&
        c.commercialId !== user.id
    );
    const clientsMerchIlyasse = ilyasse
      ? territory.filter((c) => c.commercialId === ilyasse.id)
      : [];

    const joursA = round2(clientsA.length / 6);
    const joursB = round2(clientsB.length / 6);
    const joursN = round2(clientsNouveaux.length / 6);
    const joursMTV = round2(clientsMerchTV.length / 6);
    const joursMI = round2(clientsMerchIlyasse.length / 6);
    const totalJours = round2(joursA + joursB + joursN + joursMTV + joursMI);
    const joursLibres = round2(entry.joursDispo - totalJours);

    // Summary row
    const row = wsSummary.getRow(sumRow);
    row.getCell(1).value = entry.displayName;
    row.getCell(2).value =
      entry.departements.join(", ") + (entry.belgique ? " + Belgique" : "");
    row.getCell(3).value = `${clientsA.length} (${joursA}j)`;
    row.getCell(4).value = `${clientsB.length} (${joursB}j)`;
    row.getCell(5).value = `${clientsNouveaux.length} (${joursN}j)`;
    row.getCell(6).value = `${clientsMerchTV.length} (${joursMTV}j)`;
    row.getCell(7).value = `${clientsMerchIlyasse.length} (${joursMI}j)`;
    row.getCell(8).value = totalJours;
    row.getCell(9).value = entry.joursDispo;
    const libresCell = row.getCell(10);
    libresCell.value = joursLibres;
    libresCell.font = {
      bold: true,
      color: { argb: joursLibres >= 0 ? "FF059669" : "FFDC2626" },
    };
    for (let i = 1; i <= 10; i++) row.getCell(i).font = { ...(row.getCell(i).font ?? {}), size: 9 };
    row.getCell(1).font = { size: 9, bold: true };
    sumRow++;

    // Sheet per commercial
    const ws = wb.addWorksheet(entry.displayName);
    ws.columns = [
      { key: "codeClient", width: 14 },
      { key: "nom", width: 38 },
      { key: "codePostal", width: 12 },
      { key: "telephone", width: 18 },
      { key: "categorie", width: 18 },
    ];

    // Sheet title
    ws.mergeCells("A1:E1");
    const titleCell = ws.getCell("A1");
    titleCell.value = `${entry.displayName} — ${entry.joursDispo} jours disponibles`;
    titleCell.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E40AF" } };
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 28;

    // Summary line
    ws.mergeCells("A2:E2");
    const sumLine = ws.getCell("A2");
    sumLine.value =
      `Strat. A: ${clientsA.length} (${joursA}j)  |  Réguliers B: ${clientsB.length} (${joursB}j)  |  ` +
      `Nouveaux: ${clientsNouveaux.length} (${joursN}j)  |  Merch TV: ${clientsMerchTV.length} (${joursMTV}j)  |  ` +
      `Merch Ilyasse: ${clientsMerchIlyasse.length} (${joursMI}j)  |  Total: ${totalJours}j / ${entry.joursDispo}j`;
    sumLine.font = { italic: true, size: 9, color: { argb: "FF374151" } };
    sumLine.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFF6FF" } };
    sumLine.alignment = { horizontal: "center" };
    ws.getRow(2).height = 18;

    let curRow = 3;
    curRow = writeSection(ws, "Stratégiques (A)", clientsA, "FF7C3AED", "FFEDE9FE", curRow);
    curRow = writeSection(ws, "Réguliers (B)", clientsB, "FF1D4ED8", "FFDBEAFE", curRow);
    curRow = writeSection(ws, "Nouveaux", clientsNouveaux, "FF059669", "FFD1FAE5", curRow);
    curRow = writeSection(ws, "Merch Télévente", clientsMerchTV, "FFD97706", "FFFEF3C7", curRow);
    writeSection(ws, "Merch Ilyasse", clientsMerchIlyasse, "FF6B7280", "FFF3F4F6", curRow);
  }

  const buffer = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(buffer as ArrayBuffer, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="planning_clients_${date}.xlsx"`,
    },
  });
}
