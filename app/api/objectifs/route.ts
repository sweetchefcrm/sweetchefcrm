import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET /api/objectifs?commercialId=xxx&mois=4&annee=2026
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const rawId = searchParams.get("commercialId") || "me";
  const commercialId = rawId === "me" ? session.user.id : rawId;
  const mois = parseInt(searchParams.get("mois") || String(new Date().getMonth() + 1));
  const annee = parseInt(searchParams.get("annee") || String(new Date().getFullYear()));

  const objectif = await prisma.objectif.findUnique({
    where: { commercialId_mois_annee: { commercialId, mois, annee } },
  });

  return NextResponse.json({
    objectif: objectif
      ? { montantCible: Number(objectif.montantCible), tauxCroissance: objectif.tauxCroissance }
      : null,
  });
}
