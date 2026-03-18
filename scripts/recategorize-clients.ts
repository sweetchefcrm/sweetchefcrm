import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { recategorizeClients } from "../lib/recategorize";
import prisma from "../lib/prisma";

async function main() {
  console.log("🔄 Recatégorisation des clients en cours...\n");
  const result = await recategorizeClients();

  console.log(`✅ ${result.total} clients traités`);
  console.log(`✅ ${result.prospectsCreated} nouveau(x) prospect(s) créé(s)\n`);
  console.log("📊 Répartition :");
  for (const [cat, count] of Object.entries(result.byCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`   ${cat.padEnd(15)} : ${count}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
