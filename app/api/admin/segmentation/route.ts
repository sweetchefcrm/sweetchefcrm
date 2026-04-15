import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

const MOIS_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = session.user.role as Role;
  const ALLOWED: Role[] = [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL, Role.CHEF_TERRAIN, Role.CHEF_TELEVENTE];
  if (!ALLOWED.includes(role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const moisParam = searchParams.get("mois");
  const anneeParam = searchParams.get("annee");
  const commercialIdParam = searchParams.get("commercialId") ?? "all";
  const rawTeamType = searchParams.get("teamType") ?? "all";

  const teamType =
    role === Role.CHEF_TERRAIN ? "TERRAIN"
    : role === Role.CHEF_TELEVENTE ? "TELEVENTE"
    : rawTeamType;

  // Liste des commerciaux pour le filtre UI
  const commerciauxListWhere =
    role === Role.CHEF_TERRAIN ? { teamType: "TERRAIN" as const }
    : role === Role.CHEF_TELEVENTE ? { teamType: "TELEVENTE" as const }
    : {};

  const commerciauxList = await prisma.user.findMany({
    where: { ...commerciauxListWhere, role: { notIn: [Role.ADMIN, Role.DESACTIVE] } },
    select: { id: true, name: true, teamType: true, role: true },
    orderBy: { name: "asc" },
  });

  // Filtre clients
  let clientWhere: Record<string, unknown> = {};
  if (commercialIdParam !== "all") {
    clientWhere.commercialId = commercialIdParam;
  } else if (teamType !== "all") {
    const teamUsers = await prisma.user.findMany({
      where: { teamType: teamType as "TERRAIN" | "TELEVENTE" },
      select: { id: true },
    });
    clientWhere.commercialId = { in: teamUsers.map((u) => u.id) };
  }

  const clients = await prisma.client.findMany({
    where: clientWhere,
    select: { id: true, categorieStatut: true, sousCategorie: true, categorieType: true, commercialId: true },
  });

  const clientIds = clients.map((c) => c.id);
  const clientMap = Object.fromEntries(clients.map((c) => [c.id, c]));

  // ── Résumé global (filtré par période si sélectionnée) ────────────────────
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
  const commAgg: Record<string, { ca: number; nb: number }> = {};
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
    sousCatAgg[sousCat] = { ca: (sousCatAgg[sousCat]?.ca ?? 0) + ca, nb: (sousCatAgg[sousCat]?.nb ?? 0) + nb };

    const type = client.categorieType ?? "Non défini";
    typeAgg[type] = { ca: (typeAgg[type]?.ca ?? 0) + ca, nb: (typeAgg[type]?.nb ?? 0) + nb };

    const commId = client.commercialId;
    commAgg[commId] = { ca: (commAgg[commId]?.ca ?? 0) + ca, nb: (commAgg[commId]?.nb ?? 0) + nb };
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

  // Classement commerciaux
  const commIds = Object.keys(commAgg);
  const usersInfo = await prisma.user.findMany({
    where: { id: { in: commIds } },
    select: { id: true, name: true, teamType: true },
  });
  const userInfoMap = Object.fromEntries(usersInfo.map((u) => [u.id, u]));

  const parCommercial = Object.entries(commAgg)
    .map(([id, v]) => ({
      id,
      name: userInfoMap[id]?.name ?? "Inconnu",
      teamType: userInfoMap[id]?.teamType ?? null,
      ca: Math.round(v.ca * 100) / 100,
      nb: v.nb,
      pct: totalCA > 0 ? Math.round((v.ca / totalCA) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.ca - a.ca);

  // ── Breakdown mensuel (uniquement quand un commercial est sélectionné) ─────
  let parMois: {
    mois: number;
    annee: number;
    label: string;
    total: number;
    nb: number;
    parCategorie: Record<string, number>;
    parSousCategorie: Record<string, number>;
    parType: Record<string, number>;
  }[] = [];

  if (commercialIdParam !== "all" && clientIds.length > 0) {
    // Toutes les ventes du commercial, sans filtre de période
    const ventesDetail = await prisma.vente.groupBy({
      by: ["clientId", "mois", "annee"],
      where: { clientId: { in: clientIds } },
      _sum: { montant: true },
      _count: { _all: true },
      orderBy: [{ annee: "asc" }, { mois: "asc" }],
    });

    const moisCatAgg: Record<string, Record<string, number>> = {};
    const moisSousCatAgg: Record<string, Record<string, number>> = {};
    const moisTypeAgg: Record<string, Record<string, number>> = {};
    const moisTotals: Record<string, { total: number; nb: number; mois: number; annee: number }> = {};

    for (const v of ventesDetail) {
      const client = clientMap[v.clientId];
      if (!client) continue;
      const ca = Number(v._sum.montant ?? 0);
      const key = `${v.annee}-${String(v.mois as number).padStart(2, "0")}`;

      if (!moisTotals[key]) moisTotals[key] = { total: 0, nb: 0, mois: v.mois as number, annee: v.annee as number };
      if (!moisCatAgg[key]) moisCatAgg[key] = {};
      if (!moisSousCatAgg[key]) moisSousCatAgg[key] = {};
      if (!moisTypeAgg[key]) moisTypeAgg[key] = {};

      moisTotals[key].total += ca;
      moisTotals[key].nb += v._count._all;

      const cat = client.categorieStatut ?? "Non défini";
      moisCatAgg[key][cat] = (moisCatAgg[key][cat] ?? 0) + ca;

      const sousCat = client.sousCategorie ?? "Non défini";
      moisSousCatAgg[key][sousCat] = (moisSousCatAgg[key][sousCat] ?? 0) + ca;

      const type = client.categorieType ?? "Non défini";
      moisTypeAgg[key][type] = (moisTypeAgg[key][type] ?? 0) + ca;
    }

    parMois = Object.entries(moisTotals)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, t]) => ({
        mois: t.mois,
        annee: t.annee,
        label: `${MOIS_LABELS[t.mois - 1]} ${t.annee}`,
        total: Math.round(t.total * 100) / 100,
        nb: t.nb,
        parCategorie: Object.fromEntries(
          Object.entries(moisCatAgg[key]).map(([k, v]) => [k, Math.round(v * 100) / 100])
        ),
        parSousCategorie: Object.fromEntries(
          Object.entries(moisSousCatAgg[key]).map(([k, v]) => [k, Math.round(v * 100) / 100])
        ),
        parType: Object.fromEntries(
          Object.entries(moisTypeAgg[key]).map(([k, v]) => [k, Math.round(v * 100) / 100])
        ),
      }));
  }

  // Mois disponibles pour le sélecteur de période
  const moisDisponibles = await prisma.vente.groupBy({
    by: ["mois", "annee"],
    where: clientIds.length > 0 ? { clientId: { in: clientIds } } : {},
    orderBy: [{ annee: "desc" }, { mois: "desc" }],
  });

  return NextResponse.json({
    parCategorie: toList(catAgg),
    parSousCategorie: toList(sousCatAgg),
    parType: toList(typeAgg),
    parCommercial,
    parMois,
    totalCA: Math.round(totalCA * 100) / 100,
    commerciauxList,
    moisDisponibles: moisDisponibles.map((m) => ({ mois: m.mois as number, annee: m.annee as number })),
  });
}
