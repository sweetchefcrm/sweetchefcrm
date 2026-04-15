import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

const PRIVILEGED: Role[] = [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL, Role.CHEF_TERRAIN, Role.CHEF_TELEVENTE];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const role = session.user.role as Role;
  const userId = session.user.id;
  const commercialId = id === "me" ? userId : id;

  const isPrivileged = PRIVILEGED.includes(role);

  if (!isPrivileged && commercialId !== userId) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  // Chefs : vérifier que le commercial est dans leur équipe
  if (role === Role.CHEF_TERRAIN || role === Role.CHEF_TELEVENTE) {
    const target = await prisma.user.findUnique({
      where: { id: commercialId },
      select: { teamType: true },
    });
    const requiredTeam = role === Role.CHEF_TERRAIN ? "TERRAIN" : "TELEVENTE";
    if (target?.teamType !== requiredTeam) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const { searchParams } = new URL(req.url);
  const moisParam = searchParams.get("mois");
  const anneeParam = searchParams.get("annee");

  const clients = await prisma.client.findMany({
    where: { commercialId },
    select: {
      id: true,
      categorieStatut: true,
      sousCategorie: true,
      categorieType: true,
    },
  });

  const clientIds = clients.map((c) => c.id);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

  const venteWhere: Record<string, unknown> = {
    clientId: clientIds.length > 0 ? { in: clientIds } : { in: [] },
  };
  if (moisParam && anneeParam) {
    venteWhere.mois = parseInt(moisParam);
    venteWhere.annee = parseInt(anneeParam);
  }

  const ventesByClient = await prisma.vente.groupBy({
    by: ["clientId"],
    where: venteWhere,
    _sum: { montant: true },
    _count: { _all: true },
  });

  const catAgg: Record<string, { ca: number; nb: number }> = {};
  const sousCatAgg: Record<string, { ca: number; nb: number }> = {};
  const typeAgg: Record<string, { ca: number; nb: number }> = {};
  let totalCA = 0;

  for (const v of ventesByClient) {
    const client = clientMap[v.clientId];
    if (!client) continue;
    const ca = Number(v._sum.montant ?? 0);
    const nb = v._count._all;
    totalCA += ca;

    const cat = client.categorieStatut ?? "Non défini";
    catAgg[cat] = { ca: (catAgg[cat]?.ca ?? 0) + ca, nb: (catAgg[cat]?.nb ?? 0) + nb };

    const sousCat = client.sousCategorie ?? "Non défini";
    sousCatAgg[sousCat] = {
      ca: (sousCatAgg[sousCat]?.ca ?? 0) + ca,
      nb: (sousCatAgg[sousCat]?.nb ?? 0) + nb,
    };

    const type = client.categorieType ?? "Non défini";
    typeAgg[type] = { ca: (typeAgg[type]?.ca ?? 0) + ca, nb: (typeAgg[type]?.nb ?? 0) + nb };
  }

  function toList(agg: Record<string, { ca: number; nb: number }>) {
    return Object.entries(agg)
      .map(([label, v]) => ({
        label,
        ca: Math.round(v.ca * 100) / 100,
        nb: v.nb,
        pct: totalCA > 0 ? Math.round((v.ca / totalCA) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.ca - a.ca);
  }

  const moisDisponibles = await prisma.vente.groupBy({
    by: ["mois", "annee"],
    where: clientIds.length > 0 ? { clientId: { in: clientIds } } : {},
    orderBy: [{ annee: "desc" }, { mois: "desc" }],
  });

  return NextResponse.json({
    parCategorie: toList(catAgg),
    parSousCategorie: toList(sousCatAgg),
    parType: toList(typeAgg),
    totalCA: Math.round(totalCA * 100) / 100,
    moisDisponibles: moisDisponibles.map((m) => ({
      mois: m.mois as number,
      annee: m.annee as number,
    })),
  });
}
