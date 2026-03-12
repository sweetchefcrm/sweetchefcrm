import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  const role = session.user.role as Role;
  const ALLOWED: Role[] = [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL, Role.CHEF_TERRAIN, Role.CHEF_TELEVENTE];
  if (!ALLOWED.includes(role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get("period") ?? "monthly") as "daily" | "monthly";
  const commercialId = searchParams.get("commercialId") ?? "all";
  // Les chefs sont scopés à leur équipe, sauf si ADMIN/COMMERCIAL_PRINCIPAL
  const teamTypeParam = searchParams.get("teamType") ?? "all";
  const teamType =
    role === Role.CHEF_TERRAIN ? "TERRAIN"
    : role === Role.CHEF_TELEVENTE ? "TELEVENTE"
    : teamTypeParam;
  const selectedMonth = searchParams.get("month") ?? "all"; // "all" ou "MM/YYYY"

  // ── 1. Liste des commerciaux ──────────────────────────────────────────────
  const commerciauxListWhere =
    role === Role.CHEF_TERRAIN ? { teamType: "TERRAIN" as const }
    : role === Role.CHEF_TELEVENTE ? { teamType: "TELEVENTE" as const }
    : { role: { not: Role.ADMIN } };

  const commerciauxList = await prisma.user.findMany({
    where: commerciauxListWhere,
    select: { id: true, name: true, role: true, teamType: true },
    orderBy: { name: "asc" },
  });

  // ── 2. Construire le filtre WHERE pour les ventes ─────────────────────────
  // Priorité : commercialId spécifique > filtre équipe > tout
  let venteWhere: Record<string, unknown> = {};

  if (commercialId !== "all") {
    venteWhere = { commercialId };
  } else if (teamType !== "all") {
    const teamUsers = await prisma.user.findMany({
      where: { teamType: teamType as "TERRAIN" | "TELEVENTE" },
      select: { id: true },
    });
    venteWhere = { commercialId: { in: teamUsers.map((u) => u.id) } };
  } else if (role === Role.CHEF_TERRAIN || role === Role.CHEF_TELEVENTE) {
    // Sécurité : un chef ne peut jamais voir en dehors de son équipe
    const scopedTeam = role === Role.CHEF_TERRAIN ? "TERRAIN" : "TELEVENTE";
    const teamUsers = await prisma.user.findMany({
      where: { teamType: scopedTeam },
      select: { id: true },
    });
    venteWhere = { commercialId: { in: teamUsers.map((u) => u.id) } };
  }

  // ── 3. CA par catégorie statut / type ────────────────────────────────────
  const ventesByClient = await prisma.vente.groupBy({
    by: ["clientId"],
    where: venteWhere,
    _sum: { montant: true },
  });

  const clientsWithCat = await prisma.client.findMany({
    select: { id: true, categorieStatut: true, categorieType: true },
  });

  const clientMapStatut: Record<string, string> = {};
  const clientMapType: Record<string, string> = {};
  for (const c of clientsWithCat) {
    clientMapStatut[c.id] = c.categorieStatut ?? "Non défini";
    clientMapType[c.id] = c.categorieType ?? "Non défini";
  }

  const statutAgg: Record<string, number> = {};
  const typeAgg: Record<string, number> = {};
  for (const v of ventesByClient) {
    const montant = Number(v._sum.montant ?? 0);
    const statut = clientMapStatut[v.clientId] ?? "Non défini";
    const type = clientMapType[v.clientId] ?? "Non défini";
    statutAgg[statut] = (statutAgg[statut] ?? 0) + montant;
    typeAgg[type] = (typeAgg[type] ?? 0) + montant;
  }

  const caParStatut = Object.entries(statutAgg)
    .map(([statut, ca]) => ({ statut, ca: Math.round(ca * 100) / 100 }))
    .sort((a, b) => b.ca - a.ca);

  const caParType = Object.entries(typeAgg)
    .map(([type, ca]) => ({ type, ca: Math.round(ca * 100) / 100 }))
    .sort((a, b) => b.ca - a.ca);

  // ── 4. Évolution mensuelle — TOUS les mois existants + différentiel ───────
  const evolutionRaw = await prisma.vente.groupBy({
    by: ["annee", "mois"],
    where: venteWhere,
    _sum: { montant: true },
    orderBy: [{ annee: "asc" }, { mois: "asc" }],
  });

  const evolutionMensuelle = evolutionRaw.map((v, i) => {
    const ca = Math.round(Number(v._sum.montant ?? 0) * 100) / 100;
    const prevCa = i > 0 ? Math.round(Number(evolutionRaw[i - 1]._sum.montant ?? 0) * 100) / 100 : null;
    const diff = prevCa !== null ? Math.round((ca - prevCa) * 100) / 100 : null;
    const diffPct =
      prevCa !== null && prevCa > 0
        ? Math.round(((ca - prevCa) / prevCa) * 1000) / 10
        : null;
    return {
      label: `${String(v.mois).padStart(2, "0")}/${v.annee}`,
      mois: v.mois,
      annee: v.annee,
      ca,
      diff,
      diffPct,
    };
  });

  // ── 5. CA par commercial (classement) ────────────────────────────────────
  let caParCommercial: unknown[];

  if (commercialId === "all") {
    // Appliquer filtre de mois si sélectionné
    let rankingWhere = { ...venteWhere };
    if (selectedMonth !== "all") {
      const [mm, yyyy] = selectedMonth.split("/").map(Number);
      rankingWhere = { ...venteWhere, mois: mm, annee: yyyy };
    }

    // Classement : un bar par commercial (filtré par équipe si applicable)
    const ventesAll = await prisma.vente.groupBy({
      by: ["commercialId"],
      where: rankingWhere,
      _sum: { montant: true },
      orderBy: { _sum: { montant: "desc" } },
    });
    const userMap: Record<string, { name: string; teamType: string | null }> = {};
    for (const u of commerciauxList) userMap[u.id] = { name: u.name, teamType: u.teamType };

    caParCommercial = ventesAll.map((v) => ({
      label: userMap[v.commercialId]?.name ?? v.commercialId,
      commercialId: v.commercialId,
      teamType: userMap[v.commercialId]?.teamType ?? null,
      ca: Math.round(Number(v._sum.montant ?? 0) * 100) / 100,
    }));
  } else if (period === "monthly") {
    const ventes = await prisma.vente.groupBy({
      by: ["annee", "mois"],
      where: venteWhere,
      _sum: { montant: true },
      orderBy: [{ annee: "asc" }, { mois: "asc" }],
    });
    caParCommercial = ventes.map((v) => ({
      label: `${String(v.mois).padStart(2, "0")}/${v.annee}`,
      ca: Math.round(Number(v._sum.montant ?? 0) * 100) / 100,
    }));
  } else {
    // daily
    const ventes = await prisma.vente.findMany({
      where: venteWhere,
      select: { dateVente: true, montant: true },
      orderBy: { dateVente: "asc" },
    });
    const dayAgg: Record<string, number> = {};
    for (const v of ventes) {
      const key = v.dateVente.toISOString().slice(0, 10);
      dayAgg[key] = (dayAgg[key] ?? 0) + Number(v.montant);
    }
    caParCommercial = Object.entries(dayAgg).map(([label, ca]) => ({
      label,
      ca: Math.round(ca * 100) / 100,
    }));
  }

  return NextResponse.json({
    caParStatut,
    caParType,
    evolutionMensuelle,
    caParCommercial,
    commerciauxList,
  });
}
