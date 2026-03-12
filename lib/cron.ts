import cron from "node-cron";
import { syncDriveFiles } from "./drive-sync";

let cronStarted = false;

export function startCronJob() {
  if (cronStarted) return;
  cronStarted = true;

  // Synchronisation quotidienne à 02h00, fuseau Europe/Paris
  cron.schedule(
    "0 2 * * *",
    async () => {
      console.log("[CRON] Démarrage synchronisation Google Drive...");
      try {
        const result = await syncDriveFiles();
        console.log(
          `[CRON] Terminé — Importés: ${result.imported}, Skippés: ${result.skipped}, Erreurs: ${result.errors}`
        );
      } catch (error) {
        console.error("[CRON] Erreur critique:", error);
      }
    },
    { timezone: "Europe/Paris" }
  );

  console.log("[CRON] Job planifié — synchronisation chaque jour à 02h00 (Europe/Paris)");
}
