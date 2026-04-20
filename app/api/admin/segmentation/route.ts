import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

const MOIS_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

// ── Helpers calendrier ────────────────────────────────────────────────────────

function weekStrToRange(weekStr: string): { gte: Date; lt: Date } {
  const [yearStr, wStr] = weekStr.split("-W");
  const year = parseInt(yearStr);
  const week = parseInt(wStr);
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const dayOfWeek = (jan4.getUTCDay() + 6) % 7; // lundi = 0
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - dayOfWeek);
  const weekMonday = new Date(week1Monday);
  weekMonday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  const weekNext = new Date(weekMonday);
  weekNext.setUTCDate(weekMonday.getUTCDate() + 7);
  return { gte: weekMonday, lt: weekNext };
}

function getWeekInfo(date: Date): { key: string; label: string } {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const dayNum = (d.getUTCDay() + 6) % 7; // lundi = 0
  const thursday = new Date(d);
  thursday.setUTCDate(d.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 4));
  const weekNum =
    1 +
    Math.round(
      ((thursday.getTime() - firstThursday.getTime()) / 86400000 -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7
    );
  const yr = thursday.getUTCFullYear();
  return { key: `${yr}-W${String(weekNum).padStart(2, "0")}`, label: `S${weekNum} ${yr}` };
}

function getDayInfo(date: Date): { key: string; label: string } {
  const d = new Date(date);
  const key = d.toISOString().split("T")[0];
  const label = d.toLocaleDateString("fr-FR", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return { key, label };
}

// ─────────────────────────────────────────────────────────────────────────────

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
  const granulariteParam = searchParams.get("granularite") ?? "mois"; // "mois" | "semaine" | "jour"
  const semaineParam = searchParams.get("semaine"); // "2026-W16"
  const jourParam = searchParams.get("jour"); // "2026-04-20"

  const teamType =
    role === Role.CHEF_TERRAIN
      ? "TERRAIN"
      : role === Role.CHEF_TELEVENTE
      ? "TELEVENTE"
      : rawTeamType;

  const commerciauxListWhere =
    role === Role.CHEF_TERRAIN
      ? { teamType: "TERRAIN" as const }
      : role === Role.CHEF_TELEVENTE
      ? { teamType: "TELEVENTE" as const }
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

  if (granulariteParam === "semaine" && semaineParam) {
    venteWhere.dateVente = weekStrToRange(semaineParam);
  } else if (granulariteParam === "jour" && jourParam) {
    const d = new Date(jourParam + "T00:00:00Z");
    const next = new Date(d);
    next.setUTCDate(d.getUTCDate() + 1);
    venteWhere.dateVente = { gte: d, lt: next };
  } else if (moisParam && anneeParam) {
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

  // ── Breakdown mensuel (pour rétro-compatibilité AdminSegmentationTab) ──────
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

  // ── Breakdown par période générique (semaine / jour) ──────────────────────
  let parPeriode: {
    key: string;
    label: string;
    total: number;
    nb: number;
    parCategorie: Record<string, number>;
    parSousCategorie: Record<string, number>;
    parType: Record<string, number>;
  }[] = [];

  if (commercialIdParam !== "all" && clientIds.length > 0) {
    if (granulariteParam === "mois") {
      // ── Vue mensuelle (Prisma groupBy sur mois/annee) ──────────────────
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

        if (!moisTotals[key])
          moisTotals[key] = { total: 0, nb: 0, mois: v.mois as number, annee: v.annee as number };
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
    } else {
      // ── Vue semaine / jour — fetch raw ventes avec dateVente ──────────
      const ventesRaw = await prisma.vente.findMany({
        where: { clientId: { in: clientIds } },
        select: { clientId: true, dateVente: true, montant: true },
      });

      const periodeMap: Record<
        string,
        {
          key: string;
          label: string;
          total: number;
          nb: number;
          cats: Record<string, number>;
          sousCats: Record<string, number>;
          types: Record<string, number>;
        }
      > = {};

      for (const v of ventesRaw) {
        const client = clientMap[v.clientId];
        if (!client) continue;
        const ca = Number(v.montant);

        const { key, label } =
          granulariteParam === "semaine" ? getWeekInfo(v.dateVente) : getDayInfo(v.dateVente);

        if (!periodeMap[key])
          periodeMap[key] = { key, label, total: 0, nb: 0, cats: {}, sousCats: {}, types: {} };

        const p = periodeMap[key];
        p.total += ca;
        p.nb += 1;

        const cat = client.categorieStatut ?? "Non défini";
        p.cats[cat] = (p.cats[cat] ?? 0) + ca;

        const sousCat = client.sousCategorie ?? "Non défini";
        p.sousCats[sousCat] = (p.sousCats[sousCat] ?? 0) + ca;

        const type = client.categorieType ?? "Non défini";
        p.types[type] = (p.types[type] ?? 0) + ca;
      }

      parPeriode = Object.values(periodeMap)
        .sort((a, b) => a.key.localeCompare(b.key))
        .map((p) => ({
          key: p.key,
          label: p.label,
          total: Math.round(p.total * 100) / 100,
          nb: p.nb,
          parCategorie: Object.fromEntries(
            Object.entries(p.cats).map(([k, v]) => [k, Math.round(v * 100) / 100])
          ),
          parSousCategorie: Object.fromEntries(
            Object.entries(p.sousCats).map(([k, v]) => [k, Math.round(v * 100) / 100])
          ),
          parType: Object.fromEntries(
            Object.entries(p.types).map(([k, v]) => [k, Math.round(v * 100) / 100])
          ),
        }));
    }
  }

  // Mois disponibles pour le sélecteur de période (granularité mois)
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
    parPeriode,
    totalCA: Math.round(totalCA * 100) / 100,
    commerciauxList,
    moisDisponibles: moisDisponibles.map((m) => ({ mois: m.mois as number, annee: m.annee as number })),
  });
}
