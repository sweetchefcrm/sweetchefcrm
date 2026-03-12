import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncDriveFiles } from "@/lib/drive-sync";
import { Role } from "@prisma/client";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  try {
    const result = await syncDriveFiles();
    return NextResponse.json({
      success: true,
      message: `Import terminé — ${result.imported} fichier(s) importé(s), ${result.skipped} ignoré(s), ${result.errors} erreur(s)`,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
