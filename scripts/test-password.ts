/**
 * Teste si bcrypt fonctionne correctement
 * Usage : npx ts-node --project tsconfig.scripts.json scripts/test-password.ts
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Test 1 : bcrypt fonctionne ?
  const hash = await bcrypt.hash("password123", 12);
  const valid = await bcrypt.compare("password123", hash);
  console.log("Test bcrypt hash/compare :", valid ? "✓ OK" : "✗ ECHEC");

  // Test 2 : comparer avec le hash stocké en base
  const admin = await prisma.user.findUnique({ where: { email: "admin@crm.com" } });
  if (!admin) {
    console.log("Compte admin@crm.com introuvable → lance npm run db:seed d'abord");
    return;
  }

  const match = await bcrypt.compare("password123", admin.password);
  console.log("Test mot de passe admin :", match ? "✓ Correct" : "✗ Hash incompatible");
  console.log("Hash stocké :", admin.password.substring(0, 20) + "...");
}

main().catch(console.error).finally(() => prisma.$disconnect());
