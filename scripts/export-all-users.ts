/**
 * Exporte TOUS les utilisateurs de la DB avec leurs accès.
 * - Génère un nouveau mot de passe pour chaque user actif
 * - Met à jour la DB avec les mots de passe hashés
 * - Exporte acces-crm.xlsx complet
 *
 * Usage: npm run db:export-users
 */

import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import crypto from "crypto";
import path from "path";

const prisma = new PrismaClient();

function generatePassword(length = 10): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#!";
  let password = "";
  const bytes = crypto.randomBytes(length * 2);
  for (let i = 0; i < length; i++) {
    password += chars[bytes[i] % chars.length];
  }
  return password;
}

function roleFrLabel(role: Role): string {
  const map: Partial<Record<Role, string>> = {
    ADMIN: "Administrateur",
    COMMERCIAL_PRINCIPAL: "Commercial Principal",
    CHEF_TERRAIN: "Chef Terrain",
    CHEF_TELEVENTE: "Chef Télévente",
    COMMERCIAL_TERRAIN: "Commercial Terrain",
    COMMERCIAL_TELEVENTE: "Commercial Télévente",
    COMMERCIAL_GRAND_COMPTE: "Commercial Grand Compte",
    MERCHANDISEUR: "Merchandiseur",
    AUTRES: "Autres",
    DESACTIVE: "Désactivé",
  };
  return map[role] ?? role;
}

const ROLE_ORDER: Role[] = [
  Role.ADMIN,
  Role.COMMERCIAL_PRINCIPAL,
  Role.CHEF_TERRAIN,
  Role.CHEF_TELEVENTE,
  Role.COMMERCIAL_TERRAIN,
  Role.COMMERCIAL_TELEVENTE,
  Role.COMMERCIAL_GRAND_COMPTE,
  Role.MERCHANDISEUR,
  Role.AUTRES,
  Role.DESACTIVE,
];

async function main() {
  console.log("══════════════════════════════════════════");
  console.log("  Export des accès CRM — tous les users");
  console.log("══════════════════════════════════════════\n");

  const users = await prisma.user.findMany({
    orderBy: { name: "asc" },
  });

  users.sort(
    (a, b) =>
      ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role) ||
      a.name.localeCompare(b.name)
  );

  const exportRows: {
    Nom: string;
    Email: string;
    "Mot de passe": string;
    Rôle: string;
    Équipe: string;
    Statut: string;
  }[] = [];

  for (const user of users) {
    const isDesactive = user.role === Role.DESACTIVE;
    let plainPassword: string;

    if (isDesactive) {
      // Pas de nouveau mot de passe pour les comptes désactivés
      plainPassword = "—";
    } else {
      plainPassword = generatePassword();
      const hashed = await bcrypt.hash(plainPassword, 12);
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashed },
      });
    }

    const equipe =
      user.teamType === "TERRAIN"
        ? "Terrain"
        : user.teamType === "TELEVENTE"
        ? "Télévente"
        : "—";

    console.log(
      `  ${isDesactive ? "✗" : "✓"} ${user.name.padEnd(20)} ${user.email.padEnd(35)} ${roleFrLabel(user.role)}`
    );

    exportRows.push({
      Nom: user.name,
      Email: user.email,
      "Mot de passe": plainPassword,
      Rôle: roleFrLabel(user.role),
      Équipe: equipe,
      Statut: isDesactive ? "Désactivé" : "Actif",
    });
  }

  // ── Export Excel ──────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportRows);

  // Style header
  ws["!cols"] = [
    { wch: 22 }, // Nom
    { wch: 35 }, // Email
    { wch: 15 }, // Mot de passe
    { wch: 25 }, // Rôle
    { wch: 12 }, // Équipe
    { wch: 12 }, // Statut
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Accès CRM");

  const outputPath = path.join(process.cwd(), "acces-crm.xlsx");
  XLSX.writeFile(wb, outputPath);

  const actifs = exportRows.filter((r) => r.Statut === "Actif").length;
  const desactives = exportRows.filter((r) => r.Statut === "Désactivé").length;

  console.log(`\n══════════════════════════════════════════`);
  console.log(`  ${actifs} comptes actifs (mots de passe réinitialisés)`);
  console.log(`  ${desactives} comptes désactivés (non modifiés)`);
  console.log(`  Export : ${outputPath}`);
  console.log(`══════════════════════════════════════════`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
