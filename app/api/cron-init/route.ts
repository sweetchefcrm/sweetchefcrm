import { NextResponse } from "next/server";

// Ce endpoint n'est pas utilisé directement mais importer le module
// suffit à démarrer le cron job dans le process Next.js
let initialized = false;

export async function GET() {
  if (!initialized) {
    initialized = true;
    const { startCronJob } = await import("@/lib/cron");
    startCronJob();
  }
  return NextResponse.json({ status: "Cron job démarré" });
}
