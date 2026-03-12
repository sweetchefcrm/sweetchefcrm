/**
 * Met à jour les rôles des commerciaux depuis commerciaux.xlsx
 * Usage : npm run db:update-roles
 */

import * as path from "path";
import * as XLSX from "xlsx";
import { PrismaClient, Role, TeamType } from "@prisma/client";

const prisma = new PrismaClient();

const EXCEL_PATH = path.resolve("C:/Users/hamza/Downloads/commerciaux (1).xlsx");

// Mapping rôle Excel → { role Prisma, teamType }
const ROLE_MAP: Record<string, { role: Role; teamType: TeamType | null }> = {
  "COMMERCIAL TERRAIN":      { role: Role.COMMERCIAL_TERRAIN,      teamType: TeamType.TERRAIN   },
  "COMMERCIAL TELEVENTE":    { role: Role.COMMERCIAL_TELEVENTE,    teamType: TeamType.TELEVENTE  },
  "COMMERCIAL GRAND COMPTE": { role: Role.COMMERCIAL_GRAND_COMPTE, teamType: null               },
  "MERCHANDISEUR":           { role: Role.MERCHANDISEUR,           teamType: null               },
  "AUTRES":                  { role: Role.AUTRES,                  teamType: null               },
  "DESACTIVE":               { role: Role.DESACTIVE,               teamType: null               },
};

async function main() {
  console.log("=== Mise à jour des rôles commerciaux ===\n");

  const wb = XLSX.readFile(EXCEL_PATH);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  const dataRows = rows.slice(1) as (string | null)[][];

  let updated = 0;
  let notFound = 0;

  for (const row of dataRows) {
    const nom      = String(row[0] ?? "").trim();
    const email    = String(row[1] ?? "").trim().toLowerCase();
    const roleExcel = String(row[2] ?? "").trim().toUpperCase();

    if (!email) continue;

    const mapping = ROLE_MAP[roleExcel];
    if (!mapping) {
      console.log(`  ⚠  Rôle inconnu "${roleExcel}" pour ${nom} — ignoré`);
      continue;
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: email, mode: "insensitive" } },
          { name:  { equals: nom,   mode: "insensitive" } },
        ],
      },
    });

    if (!user) {
      console.log(`  ✗  Introuvable : ${nom} <${email}>`);
      notFound++;
      continue;
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { role: mapping.role, teamType: mapping.teamType },
    });

    console.log(`  ✓  ${nom.padEnd(18)} → ${mapping.role}${mapping.teamType ? ` (${mapping.teamType})` : ""}`);
    updated++;
  }

  console.log("\n=== Résultat ===");
  console.log(`  Mis à jour   : ${updated}`);
  console.log(`  Introuvables : ${notFound}`);
}

main()
  .catch((err) => { console.error("Erreur critique :", err); process.exit(1); })
  .finally(() => prisma.$disconnect());
