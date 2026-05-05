import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";
import prisma from "@/lib/prisma";

// DELETE — supprimer un import avoir (rollback)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;
  const log = await prisma.avoirImportLog.findUnique({ where: { id } });
  if (!log) {
    return NextResponse.json({ error: "Import introuvable" }, { status: 404 });
  }

  const deleted = await prisma.avoir.deleteMany({ where: { importBatchId: id } });
  await prisma.avoirImportLog.delete({ where: { id } });

  return NextResponse.json({ success: true, avoirsDeleted: deleted.count });
}
