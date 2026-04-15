import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const log = await prisma.importLog.findUnique({ where: { id: params.id } });
  if (!log) {
    return NextResponse.json({ error: "Import introuvable" }, { status: 404 });
  }

  // 1. Supprimer ventes taguées avec ce batch (imports récents)
  const byBatch = await prisma.vente.deleteMany({
    where: { importBatchId: params.id },
  });

  let deleted = byBatch.count;

  // 2. Fallback pour anciens imports (sans importBatchId) : utiliser createdAt
  if (deleted === 0) {
    const prevLog = await prisma.importLog.findFirst({
      where: { importedAt: { lt: log.importedAt } },
      orderBy: { importedAt: "desc" },
    });
    const fromDate = prevLog?.importedAt ?? new Date(0);

    const byDate = await prisma.vente.deleteMany({
      where: {
        importBatchId: null,
        createdAt: { gt: fromDate, lte: log.importedAt },
      },
    });
    deleted = byDate.count;
  }

  // 3. Supprimer le log d'import (permet de ré-importer ce fichier si besoin)
  await prisma.importLog.delete({ where: { id: params.id } });

  return NextResponse.json({ success: true, ventesDeleted: deleted });
}
