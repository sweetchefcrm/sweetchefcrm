import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

const COMMERCIAL_ROLES: Role[] = [
  Role.COMMERCIAL_TERRAIN,
  Role.COMMERCIAL_TELEVENTE,
  Role.COMMERCIAL_GRAND_COMPTE,
  Role.MERCHANDISEUR,
  Role.AUTRES,
];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = session.user.role as Role;
  const userId = session.user.id;
  const { clientId } = await params;

  try {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    include: { commercial: { select: { id: true, name: true, teamType: true } } },
  });

  if (!client) return NextResponse.json({ error: "Client non trouvé" }, { status: 404 });

  // Authorization check
  if (COMMERCIAL_ROLES.includes(role) && client.commercialId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (role === Role.CHEF_TERRAIN && client.commercial.teamType !== "TERRAIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (role === Role.CHEF_TELEVENTE && client.commercial.teamType !== "TELEVENTE") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Get all facings ordered chronologically
  const facings = await prisma.facing.findMany({
    where: { clientId },
    orderBy: { mois: "asc" },
  });

  // Get all ventes for this client grouped by month
  const ventes = await prisma.vente.findMany({
    where: { clientId },
    select: { montant: true, mois: true, annee: true },
  });

  const caParMoisMap: Record<string, number> = {};
  for (const v of ventes) {
    const key = `${v.annee}-${String(v.mois).padStart(2, "0")}`;
    caParMoisMap[key] = (caParMoisMap[key] ?? 0) + Number(v.montant);
  }

  // Build history: each facing entry + the previous as reference
  const history = facings.map((f, idx) => {
    const d = new Date(f.mois);
    const moisKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const caMensuel = caParMoisMap[moisKey] ?? 0;
    const caParFacing = f.nbFacings > 0 ? Math.round(caMensuel / f.nbFacings) : 0;
    const prevFacing = idx > 0 ? facings[idx - 1] : null;
    const evolution =
      prevFacing && prevFacing.nbFacings > 0
        ? Math.round(
            ((f.nbFacings - prevFacing.nbFacings) / prevFacing.nbFacings) * 100
          )
        : null;

    return {
      id: f.id,
      mois: f.mois,
      nbFacings: f.nbFacings,
      reference: prevFacing?.nbFacings ?? null,
      evolution,
      caMensuel,
      caParFacing,
    };
  });

  // Also return CA months that don't have a facing (for context)
  const caParMois = Object.entries(caParMoisMap)
    .map(([key, ca]) => {
      const [annee, mois] = key.split("-").map(Number);
      return { annee, mois, ca };
    })
    .sort((a, b) => a.annee !== b.annee ? a.annee - b.annee : a.mois - b.mois);

  return NextResponse.json({
    client: {
      id: client.id,
      nom: client.nom,
      codeClient: client.codeClient,
      categorieType: client.categorieType,
      commercial: client.commercial,
    },
    history,
    caParMois,
  });
  } catch (e) {
    console.error("[facing/clientId]", e);
    return NextResponse.json({ error: "Erreur serveur", history: [], caParMois: [] }, { status: 500 });
  }
}
