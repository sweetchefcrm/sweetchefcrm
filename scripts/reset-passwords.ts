/**
 * Remet le mot de passe "password123" pour TOUS les utilisateurs
 * Usage : npx ts-node --project tsconfig.scripts.json scripts/reset-passwords.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("admin123", 12);
  const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });

  for (const user of users) {
    await prisma.user.update({ where: { id: user.id }, data: { password: hash } });
    console.log(`✓ ${user.name.padEnd(25)} → ${user.email}`);
  }

  console.log(`\n${users.length} mots de passe réinitialisés → admin123`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
