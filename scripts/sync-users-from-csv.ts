/**
 * Synchronise les utilisateurs depuis la liste CSV.
 * - Met à jour email (sweetchef.com), rôle, teamType pour chaque user trouvé
 * - Génère un nouveau mot de passe pour chaque user (reset)
 * - Crée les users absents de la DB
 * - Désactive les users DB absents du CSV (hors ADMIN/COMMERCIAL_PRINCIPAL)
 * - Exporte acces-crm.xlsx avec tous les accès
 *
 * Usage: npm run db:sync-users
 */

import { PrismaClient, Role, TeamType } from "@prisma/client";
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

interface UserEntry {
  name: string;
  email: string;
  role: Role;
  teamType: TeamType | null;
}

const USERS_FROM_CSV: UserEntry[] = [
  { name: "ANAS",      email: "anas@sweetchef.com",      role: Role.MERCHANDISEUR,           teamType: null },
  { name: "AZIZ",      email: "aziz@sweetchef.com",      role: Role.ADMIN,                   teamType: null },
  { name: "BRAHIM",    email: "brahim@sweetchef.com",    role: Role.ADMIN,                   teamType: null },
  { name: "Evomunio",  email: "evomunio@sweetchef.com",  role: Role.AUTRES,                  teamType: null },
  { name: "FADOUA",    email: "fadoua@sweetchef.com",    role: Role.COMMERCIAL_TERRAIN,      teamType: TeamType.TERRAIN },
  { name: "Hamza",     email: "hamza@sweetchef.com",     role: Role.COMMERCIAL_TERRAIN,      teamType: TeamType.TERRAIN },
  { name: "ILYASSE",   email: "ilyasse@sweetchef.com",   role: Role.COMMERCIAL_GRAND_COMPTE, teamType: null },
  { name: "INES",      email: "ines@sweetchef.com",      role: Role.COMMERCIAL_TELEVENTE,    teamType: TeamType.TELEVENTE },
  { name: "KARIMA",    email: "karima@sweetchef.com",    role: Role.DESACTIVE,               teamType: null },
  { name: "KENZA",     email: "kenza@sweetchef.com",     role: Role.COMMERCIAL_TELEVENTE,    teamType: TeamType.TELEVENTE },
  { name: "MAISSA",    email: "maissa@sweetchef.com",    role: Role.COMMERCIAL_TERRAIN,      teamType: TeamType.TERRAIN },
  { name: "Moha",      email: "moha@sweetchef.com",      role: Role.COMMERCIAL_TERRAIN,      teamType: TeamType.TERRAIN },
  { name: "Noura",     email: "noura@sweetchef.com",     role: Role.COMMERCIAL_TELEVENTE,    teamType: TeamType.TELEVENTE },
  { name: "Rizlane",   email: "rizlane@sweetchef.com",   role: Role.COMMERCIAL_TELEVENTE,    teamType: TeamType.TELEVENTE },
  { name: "SIHAM",     email: "siham@sweetchef.com",     role: Role.COMMERCIAL_TELEVENTE,    teamType: TeamType.TELEVENTE },
  { name: "SONIA",     email: "sonia@sweetchef.com",     role: Role.MERCHANDISEUR,           teamType: null },
  { name: "Sophia",    email: "sophia@sweetchef.com",    role: Role.COMMERCIAL_TELEVENTE,    teamType: TeamType.TELEVENTE },
  { name: "TAHA TAHA", email: "taha.taha@sweetchef.com", role: Role.MERCHANDISEUR,           teamType: null },
  { name: "Wassil",    email: "wassil@sweetchef.com",    role: Role.COMMERCIAL_TERRAIN,      teamType: TeamType.TERRAIN },
  { name: "YASSINE",   email: "yassine@sweetchef.com",   role: Role.DESACTIVE,               teamType: null },
  { name: "ZAKARIA",   email: "zakaria@sweetchef.com",   role: Role.DESACTIVE,               teamType: null },
  { name: "ZOUHAIR",   email: "zouhair@sweetchef.com",   role: Role.COMMERCIAL_TERRAIN,      teamType: TeamType.TERRAIN },
  { name: "chaymae",   email: "chaymae@sweetchef.com",   role: Role.COMMERCIAL_TELEVENTE,    teamType: TeamType.TELEVENTE },
  { name: "icham",     email: "icham@sweetchef.com",     role: Role.COMMERCIAL_GRAND_COMPTE, teamType: null },
];

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

async function main() {
  console.log("══════════════════════════════════════════");
  console.log("  Synchronisation des utilisateurs CRM");
  console.log("══════════════════════════════════════════\n");

  const exportRows: {
    Nom: string;
    Email: string;
    "Mot de passe": string;
    Rôle: string;
    Équipe: string;
    Statut: string;
  }[] = [];

  // ── Traitement de chaque user du CSV ──────────────────────────────────────
  for (const entry of USERS_FROM_CSV) {
    const plainPassword = generatePassword();
    const hashed = await bcrypt.hash(plainPassword, 12);

    // Chercher par email (sweetchef ou sweetshef) OU par nom (insensible casse)
    const oldEmail = entry.email.replace("sweetchef.com", "sweetshef.com");
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { email: entry.email },
          { email: oldEmail },
          { name: { equals: entry.name, mode: "insensitive" } },
        ],
      },
    });

    const equipe = entry.teamType === "TERRAIN"
      ? "Terrain"
      : entry.teamType === "TELEVENTE"
      ? "Télévente"
      : "—";

    if (existing) {
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          name: entry.name,
          email: entry.email,
          role: entry.role,
          teamType: entry.teamType,
          password: hashed, // Reset le mot de passe
        },
      });
      console.log(`  ✓ Mis à jour : ${entry.name.padEnd(15)} ${entry.email.padEnd(35)} → ${entry.role}`);
    } else {
      await prisma.user.create({
        data: {
          name: entry.name,
          email: entry.email,
          password: hashed,
          role: entry.role,
          teamType: entry.teamType,
        },
      });
      console.log(`  + Créé      : ${entry.name.padEnd(15)} ${entry.email.padEnd(35)} → ${entry.role}`);
    }

    exportRows.push({
      Nom: entry.name,
      Email: entry.email,
      "Mot de passe": plainPassword,
      Rôle: roleFrLabel(entry.role),
      Équipe: equipe,
      Statut: entry.role === Role.DESACTIVE ? "Désactivé" : "Actif",
    });
  }

  // ── Désactiver les users DB absents du CSV ────────────────────────────────
  // Seuls ADMIN et COMMERCIAL_PRINCIPAL sont protégés de la désactivation
  const adminRoles = [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL];
  const csvEmails = new Set(USERS_FROM_CSV.map((u) => u.email));
  const csvEmailsOld = new Set(USERS_FROM_CSV.map((u) => u.email.replace("sweetchef.com", "sweetshef.com")));
  const csvNames = new Set(USERS_FROM_CSV.map((u) => u.name.toLowerCase()));

  const allUsers = await prisma.user.findMany({
    where: { role: { notIn: adminRoles } },
  });

  let deactivatedCount = 0;
  for (const user of allUsers) {
    const inCsv =
      csvEmails.has(user.email) ||
      csvEmailsOld.has(user.email) ||
      csvNames.has(user.name.toLowerCase());

    if (!inCsv && user.role !== Role.DESACTIVE) {
      await prisma.user.update({
        where: { id: user.id },
        data: { role: Role.DESACTIVE },
      });
      console.log(`  ✗ Désactivé : ${user.name.padEnd(15)} ${user.email}`);
      deactivatedCount++;
    }
  }

  // ── Ajouter les admins NON listés dans le CSV à l'export ──────────────────
  const csvEmailsInExport = new Set(USERS_FROM_CSV.map((u) => u.email));
  const adminUsers = await prisma.user.findMany({
    where: { role: { in: adminRoles } },
    orderBy: { role: "asc" },
  });

  for (const admin of adminUsers) {
    if (csvEmailsInExport.has(admin.email)) continue; // déjà dans l'export
    exportRows.unshift({
      Nom: admin.name,
      Email: admin.email,
      "Mot de passe": "admin123",
      Rôle: roleFrLabel(admin.role),
      Équipe: "—",
      Statut: "Actif",
    });
  }

  // ── Export Excel ──────────────────────────────────────────────────────────
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportRows);
  ws["!cols"] = [
    { wch: 20 }, // Nom
    { wch: 35 }, // Email
    { wch: 15 }, // Mot de passe
    { wch: 25 }, // Rôle
    { wch: 12 }, // Équipe
    { wch: 12 }, // Statut
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Accès CRM");

  const outputPath = path.join(process.cwd(), "acces-crm.xlsx");
  XLSX.writeFile(wb, outputPath);

  console.log(`\n══════════════════════════════════════════`);
  console.log(`  ${USERS_FROM_CSV.length} users traités, ${deactivatedCount} désactivés`);
  console.log(`  Export : ${outputPath}`);
  console.log(`══════════════════════════════════════════`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
