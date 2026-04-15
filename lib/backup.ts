/**
 * Sauvegarde et restauration des données (clients + ventes)
 * Les fichiers sont stockés dans /backups/*.json
 */

import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";

const BACKUP_DIR = path.join(process.cwd(), "backups");

export interface BackupMeta {
  id: string;
  createdAt: string;
  clientCount: number;
  venteCount: number;
  label?: string;
}

/** Crée une sauvegarde JSON de tous les clients et ventes. Retourne null si DB vide. */
export async function createBackup(
  prisma: PrismaClient,
  label?: string
): Promise<BackupMeta | null> {
  const [clients, ventes] = await Promise.all([
    prisma.client.findMany(),
    prisma.vente.findMany(),
  ]);

  if (clients.length === 0 && ventes.length === 0) return null;

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const now = new Date();
  const ts = now.toISOString().slice(0, 19).replace("T", "_").replace(/:/g, "-");
  const id = `backup_${ts}`;

  const meta: BackupMeta = {
    id,
    createdAt: now.toISOString(),
    clientCount: clients.length,
    venteCount: ventes.length,
    label,
  };

  fs.writeFileSync(
    path.join(BACKUP_DIR, `${id}.json`),
    JSON.stringify({ ...meta, clients, ventes }),
    "utf-8"
  );

  return meta;
}

/** Liste toutes les sauvegardes disponibles (métadonnées uniquement), du plus récent au plus ancien. */
export function listBackups(): BackupMeta[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];

  const metas: BackupMeta[] = [];

  for (const file of fs.readdirSync(BACKUP_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = fs.readFileSync(path.join(BACKUP_DIR, file), "utf-8");
      const data = JSON.parse(raw);
      metas.push({
        id: data.id,
        createdAt: data.createdAt,
        clientCount: data.clientCount,
        venteCount: data.venteCount,
        label: data.label,
      });
    } catch {
      // fichier corrompu — on ignore
    }
  }

  return metas.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

/** Restaure une sauvegarde : wipe ventes + clients puis réimporte depuis le JSON. */
export async function restoreBackup(
  prisma: PrismaClient,
  id: string
): Promise<{ clientCount: number; venteCount: number }> {
  // Sécurité : éviter path traversal
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, "");
  const filePath = path.join(BACKUP_DIR, `${safeId}.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Sauvegarde introuvable : ${safeId}`);
  }

  const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));

  // 1. Supprimer les données actuelles
  await prisma.vente.deleteMany();
  await prisma.prospect.updateMany({ data: { clientId: null } });
  await prisma.client.deleteMany();

  // 2. Restaurer les clients
  if (data.clients?.length > 0) {
    const clientsData = data.clients.map((c: Record<string, unknown>) => ({
      ...c,
      dateCreation: new Date(c.dateCreation as string),
    }));
    await prisma.client.createMany({ data: clientsData, skipDuplicates: true });
  }

  // 3. Restaurer les ventes
  if (data.ventes?.length > 0) {
    const ventesData = data.ventes.map((v: Record<string, unknown>) => ({
      ...v,
      montant: String(v.montant),
      dateVente: new Date(v.dateVente as string),
      createdAt: new Date(v.createdAt as string),
    }));
    await prisma.vente.createMany({ data: ventesData, skipDuplicates: true });
  }

  return {
    clientCount: data.clients?.length ?? 0,
    venteCount: data.ventes?.length ?? 0,
  };
}
