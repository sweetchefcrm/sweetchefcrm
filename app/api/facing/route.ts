import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

const COMMERCIAL_ROLES = [
  Role.COMMERCIAL_TERRAIN,
  Role.COMMERCIAL_TELEVENTE,
  Role.COMMERCIAL_GRAND_COMPTE,
  Role.MERCHANDISEUR,
  Role.AUTRES,
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = session.user.role as Role;
  const userId = session.user.id;

  if (role === Role.DESACTIVE) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const commercialFilter = searchParams.get("commercial") || "";
  const search = searchParams.get("search") || "";
  const moisFilter = searchParams.get("mois") || ""; // format: "YYYY-MM"
  const onlyWithFacing = searchParams.get("onlyWithFacing") === "true";
  const categorieType = searchParams.get("categorieType") || "";
  const categorieStatut = searchParams.get("categorieStatut") || "";

  // Determine month for CA
  const now = new Date();
  let targetMois = now.getMonth() + 1;
  let targetAnnee = now.getFullYear();
  if (moisFilter) {
    const [yr, mo] = moisFilter.split("-").map(Number);
    if (yr && mo) { targetAnnee = yr; targetMois = mo; }
  }

  // Build scoping
  const commercialWhere: Record<string, unknown> = {};
  if (COMMERCIAL_ROLES.includes(role)) {
    commercialWhere.id = userId;
  } else if (role === Role.CHEF_TERRAIN) {
    commercialWhere.teamType = "TERRAIN";
    if (commercialFilter) commercialWhere.id = commercialFilter;
  } else if (role === Role.CHEF_TELEVENTE) {
    commercialWhere.teamType = "TELEVENTE";
    if (commercialFilter) commercialWhere.id = commercialFilter;
  } else {
    if (commercialFilter) commercialWhere.id = commercialFilter;
  }

  const clientWhere: Record<string, unknown> = {};
  if (search) clientWhere.nom = { contains: search, mode: "insensitive" };
  if (categorieType) clientWhere.categorieType = categorieType;
  if (categorieStatut) clientWhere.categorieStatut = categorieStatut;
  if (onlyWithFacing) clientWhere.facings = { some: {} };

  try {
  const clients = await prisma.client.findMany({
    where: {
      ...clientWhere,
      commercial: Object.keys(commercialWhere).length > 0 ? { ...commercialWhere } : undefined,
    },
    include: {
      commercial: { select: { id: true, name: true } },
      facings: {
        orderBy: { mois: "desc" },
        take: 2,
      },
      ventes: {
        where: { mois: targetMois, annee: targetAnnee },
        select: { montant: true },
      },
    },
    orderBy: { nom: "asc" },
  });

  const result = clients.map((client) => {
    const facingsSorted = [...client.facings].sort(
      (a, b) => new Date(b.mois).getTime() - new Date(a.mois).getTime()
    );
    const facingActuel = facingsSorted[0] ?? null;
    const facingReference = facingsSorted[1] ?? null;

    const caMensuel = client.ventes.reduce((sum, v) => sum + Number(v.montant), 0);
    const caParFacing =
      facingActuel && facingActuel.nbFacings > 0
        ? Math.round(caMensuel / facingActuel.nbFacings)
        : null;
    const evolution =
      facingActuel && facingReference && facingReference.nbFacings > 0
        ? Math.round(
            ((facingActuel.nbFacings - facingReference.nbFacings) /
              facingReference.nbFacings) *
              100
          )
        : null;

    return {
      id: client.id,
      nom: client.nom,
      codeClient: client.codeClient,
      categorieType: client.categorieType,
      categorieStatut: client.categorieStatut,
      commercial: client.commercial,
      facingActuel: facingActuel
        ? { nbFacings: facingActuel.nbFacings, mois: facingActuel.mois }
        : null,
      facingReference: facingReference
        ? { nbFacings: facingReference.nbFacings, mois: facingReference.mois }
        : null,
      evolution,
      caMensuel,
      caParFacing,
    };
  });

  // Stats
  const avecFacing = result.filter((c) => c.facingActuel !== null);
  const totalFacings = avecFacing.reduce(
    (sum, c) => sum + (c.facingActuel?.nbFacings ?? 0),
    0
  );
  const avgFacings =
    avecFacing.length > 0 ? Math.round(totalFacings / avecFacing.length) : 0;
  const avecCAFacing = avecFacing.filter((c) => c.caParFacing !== null);
  const avgCAParFacing =
    avecCAFacing.length > 0
      ? Math.round(
          avecCAFacing.reduce((sum, c) => sum + (c.caParFacing ?? 0), 0) /
            avecCAFacing.length
        )
      : 0;

  // Extract unique commerciaux for filter dropdown
  const commMap: Record<string, string> = {};
  for (const c of result) {
    commMap[c.commercial.id] = c.commercial.name;
  }

  return NextResponse.json({
    clients: result,
    commerciaux: Object.entries(commMap).map(([id, name]) => ({ id, name })),
    stats: {
      totalAvecFacing: avecFacing.length,
      totalClients: result.length,
      totalFacings,
      avgFacings,
      avgCAParFacing,
    },
  });
  } catch (e) {
    console.error("[facing GET]", e);
    return NextResponse.json({ error: "Erreur serveur", clients: [], commerciaux: [], stats: { totalAvecFacing: 0, totalClients: 0, totalFacings: 0, avgFacings: 0, avgCAParFacing: 0 } }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = session.user.role as Role;
  const userId = session.user.id;

  if (role === Role.DESACTIVE) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const { clientId, nbFacings, mois } = body;

  if (!clientId || nbFacings === undefined || !mois) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const facingsValue = parseInt(nbFacings);
  if (isNaN(facingsValue) || facingsValue < 0) {
    return NextResponse.json({ error: "Nombre de facings invalide" }, { status: 400 });
  }

  // Auth check: commercial can only add for their own clients
  if (COMMERCIAL_ROLES.includes(role)) {
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { commercialId: true },
    });
    if (!client || client.commercialId !== userId) {
      return NextResponse.json({ error: "Client non autorisé" }, { status: 403 });
    }
  } else if (role === Role.CHEF_TERRAIN || role === Role.CHEF_TELEVENTE) {
    const teamType = role === Role.CHEF_TERRAIN ? "TERRAIN" : "TELEVENTE";
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { commercial: { select: { teamType: true } } },
    });
    if (!client || client.commercial.teamType !== teamType) {
      return NextResponse.json({ error: "Client non autorisé" }, { status: 403 });
    }
  }

  // Normalize to first of month UTC
  const [yr, mo] = (mois as string).split("-").map(Number);
  const firstOfMonth = new Date(Date.UTC(yr, mo - 1, 1));

  try {
    const facing = await prisma.facing.upsert({
      where: { clientId_mois: { clientId, mois: firstOfMonth } },
      create: { clientId, userId, nbFacings: facingsValue, mois: firstOfMonth },
      update: { nbFacings: facingsValue, userId },
    });
    return NextResponse.json({ facing });
  } catch (e) {
    console.error("[facing POST]", e);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
