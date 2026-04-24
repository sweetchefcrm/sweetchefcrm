import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canAccess, PERMISSIONS } from "@/lib/permissions";
import { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = session.user.role as Role;
  if (!canAccess(role, PERMISSIONS.EDIT_DATA)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const commercialFilter = searchParams.get("commercial") || "";
  const search = searchParams.get("search") || "";
  const onlyWithLineaire = searchParams.get("onlyWithLineaire") === "true";

  const annee = new Date().getFullYear();

  // Scope par équipe pour les chefs
  const commercialWhere: Record<string, unknown> = {};
  if (role === Role.CHEF_TERRAIN) commercialWhere.teamType = "TERRAIN";
  if (role === Role.CHEF_TELEVENTE) commercialWhere.teamType = "TELEVENTE";
  if (commercialFilter) commercialWhere.id = commercialFilter;

  const clientWhere: Record<string, unknown> = {};
  if (search) clientWhere.nom = { contains: search, mode: "insensitive" };
  if (onlyWithLineaire) clientWhere.lineaire = { not: null };

  // Récupérer les clients avec leurs ventes annuelles et mensuelles
  const clients = await prisma.client.findMany({
    where: {
      ...clientWhere,
      commercial: Object.keys(commercialWhere).length > 0 ? { ...commercialWhere } : undefined,
    },
    include: {
      commercial: { select: { id: true, name: true } },
      ventes: {
        where: { annee },
        select: { montant: true, mois: true },
      },
    },
    orderBy: { nom: "asc" },
  });

  const result = clients.map((client) => {
    const caAnnuel = client.ventes.reduce((sum, v) => sum + Number(v.montant), 0);

    // CA par mois (groupé)
    const caParMoisMap: Record<number, number> = {};
    for (const v of client.ventes) {
      caParMoisMap[v.mois] = (caParMoisMap[v.mois] ?? 0) + Number(v.montant);
    }
    const caParMois = Object.entries(caParMoisMap).map(([mois, total]) => ({
      mois: parseInt(mois),
      annee,
      total,
    }));

    const caMetre = client.lineaire && client.lineaire > 0 ? caAnnuel / client.lineaire : null;

    return {
      id: client.id,
      nom: client.nom,
      codeClient: client.codeClient,
      lineaire: client.lineaire,
      commercial: client.commercial,
      caAnnuel,
      caParMois,
      caMetre: caMetre !== null ? Math.round(caMetre) : null,
    };
  });

  // Stats globales
  const avecLineaire = result.filter((c) => c.lineaire !== null && c.lineaire !== undefined);
  const totalLineaire = avecLineaire.reduce((sum, c) => sum + (c.lineaire ?? 0), 0);
  const caMoyenParMetre =
    avecLineaire.length > 0
      ? Math.round(avecLineaire.reduce((sum, c) => sum + (c.caMetre ?? 0), 0) / avecLineaire.length)
      : 0;

  return NextResponse.json({
    clients: result,
    stats: {
      totalAvecLineaire: avecLineaire.length,
      totalClients: result.length,
      caMoyenParMetre,
      totalLineaire: Math.round(totalLineaire * 10) / 10,
    },
  });
}
