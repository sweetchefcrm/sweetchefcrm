import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDataScope } from "@/lib/permissions";
import { Role } from "@prisma/client";

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const now = new Date();

  const selectedMonth = searchParams.get("mois");
  const selectedYear  = searchParams.get("annee");

  const currentMonth = selectedMonth ? parseInt(selectedMonth) : now.getMonth() + 1;
  const currentYear  = selectedYear  ? parseInt(selectedYear)  : now.getFullYear();
  const prevMonth    = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear     = currentMonth === 1 ? currentYear - 1 : currentYear;

  const scope = getDataScope(session.user.role as Role, session.user.id);

  const allClients = await prisma.client.findMany({
    where: scope.commercialId ? { commercialId: scope.commercialId } : undefined,
    select: { id: true, commercialId: true },
  });

  const clientIds = allClients.map((c) => c.id);
  const clientToCommercial = Object.fromEntries(
    allClients.map((c) => [c.id, c.commercialId])
  );

  const venteFilter = clientIds.length > 0 ? { clientId: { in: clientIds } } : {};
  const avoirFilter = clientIds.length > 0 ? { clientId: { in: clientIds } } : {};

  const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

  const sliding12Months = {
    OR: [
      { annee: currentYear - 1, mois: { gt: currentMonth } },
      { annee: currentYear - 1, mois: currentMonth },
      { annee: currentYear, mois: { lte: currentMonth } },
    ],
  };

  const [
    caCurrentMonth,
    caPrevMonth,
    avoirCurrentMonth,
    avoirPrevMonth,
    top10Clients,
    avoirsParClientMois,
    panierMoyenGlobal,
    ventesMoisParClient,
    ventesAnneeParClient,
    avoirsAnneeParClient,
    evolutionPanierMoyen,
    moisDisponibles,
  ] = await Promise.all([
    prisma.vente.aggregate({
      where: { ...venteFilter, mois: currentMonth, annee: currentYear },
      _sum: { montant: true },
    }),
    prisma.vente.aggregate({
      where: { ...venteFilter, mois: prevMonth, annee: prevYear },
      _sum: { montant: true },
    }),
    prisma.avoir.aggregate({
      where: { ...avoirFilter, mois: currentMonth, annee: currentYear },
      _sum: { montant: true },
    }),
    prisma.avoir.aggregate({
      where: { ...avoirFilter, mois: prevMonth, annee: prevYear },
      _sum: { montant: true },
    }),
    prisma.vente.groupBy({
      by: ["clientId"],
      where: { ...venteFilter, mois: currentMonth, annee: currentYear },
      _sum: { montant: true },
      orderBy: { _sum: { montant: "desc" } },
      take: 20, // prendre plus pour recalculer après déduction avoirs
    }),
    // Avoirs du mois par client (pour top10 net)
    prisma.avoir.groupBy({
      by: ["clientId"],
      where: { ...avoirFilter, mois: currentMonth, annee: currentYear },
      _sum: { montant: true },
    }),
    // Panier moyen global sur l'année sélectionnée
    prisma.vente.aggregate({
      where: { ...venteFilter, annee: currentYear },
      _avg: { montant: true },
      _count: true,
    }),
    // Ventes du mois sélectionné par client
    prisma.vente.groupBy({
      by: ["clientId"],
      where: { ...venteFilter, mois: currentMonth, annee: currentYear },
      _sum: { montant: true },
      _avg: { montant: true },
      _count: { _all: true },
    }),
    // Ventes de l'année sélectionnée par client
    prisma.vente.groupBy({
      by: ["clientId"],
      where: { ...venteFilter, annee: currentYear },
      _sum: { montant: true },
      _avg: { montant: true },
      _count: { _all: true },
    }),
    // Avoirs de l'année sélectionnée par client
    prisma.avoir.groupBy({
      by: ["clientId"],
      where: { ...avoirFilter, annee: currentYear },
      _sum: { montant: true },
    }),
    // Évolution mensuelle du panier moyen (12 mois glissants depuis le mois sélectionné)
    prisma.vente.groupBy({
      by: ["mois", "annee"],
      where: { ...venteFilter, ...sliding12Months },
      _avg: { montant: true },
      _count: { _all: true },
      orderBy: [{ annee: "asc" }, { mois: "asc" }],
    }),
    // Mois distincts disponibles dans la base
    prisma.vente.groupBy({
      by: ["mois", "annee"],
      where: venteFilter,
      orderBy: [{ annee: "desc" }, { mois: "desc" }],
    }),
  ]);

  // ── Avoirs par client en maps ─────────────────────────────────────────────
  const avoirsParClientMoisMap: Record<string, number> = {};
  for (const a of avoirsParClientMois) {
    avoirsParClientMoisMap[a.clientId] = Number(a._sum.montant || 0);
  }
  const avoirsAnneeParClientMap: Record<string, number> = {};
  for (const a of avoirsAnneeParClient) {
    avoirsAnneeParClientMap[a.clientId] = Number(a._sum.montant || 0);
  }

  // ── Enrichir top 10 clients (CA net = ventes - avoirs) ───────────────────
  const top10Computed = top10Clients
    .map((t) => ({
      clientId: t.clientId,
      ca: Math.max(0, Number(t._sum.montant || 0) - (avoirsParClientMoisMap[t.clientId] ?? 0)),
    }))
    .sort((a, b) => b.ca - a.ca)
    .slice(0, 10);

  const clientIdsTop = top10Computed.map((t) => t.clientId);
  const clientsInfo = await prisma.client.findMany({
    where: { id: { in: clientIdsTop } },
    select: { id: true, nom: true, codeClient: true },
  });
  const clientInfoMap = Object.fromEntries(clientsInfo.map((c) => [c.id, c]));
  const top10 = top10Computed.map((t) => ({
    ...clientInfoMap[t.clientId],
    ca: t.ca,
  }));

  // ── CA net + panier moyen par commercial ─────────────────────────────────
  const caParCommercialMap: Record<string, number> = {};
  const panierMoyenMap: Record<string, { totalMontant: number; nbVentes: number }> = {};

  for (const v of ventesMoisParClient) {
    const commId = clientToCommercial[v.clientId];
    if (!commId) continue;
    const ca = Number(v._sum.montant || 0) - (avoirsParClientMoisMap[v.clientId] ?? 0);
    caParCommercialMap[commId] = (caParCommercialMap[commId] ?? 0) + ca;
  }

  for (const v of ventesAnneeParClient) {
    const commId = clientToCommercial[v.clientId];
    if (!commId) continue;
    const avoirAnnee = avoirsAnneeParClientMap[v.clientId] ?? 0;
    const total = Math.max(0, Number(v._sum.montant || 0) - avoirAnnee);
    const nb = v._count._all;
    if (!panierMoyenMap[commId]) panierMoyenMap[commId] = { totalMontant: 0, nbVentes: 0 };
    panierMoyenMap[commId].totalMontant += total;
    panierMoyenMap[commId].nbVentes += nb;
  }

  const commercialIds = [
    ...new Set([...Object.keys(caParCommercialMap), ...Object.keys(panierMoyenMap)]),
  ];
  const commerciaux = await prisma.user.findMany({
    where: { id: { in: commercialIds } },
    select: { id: true, name: true, teamType: true, role: true },
  });
  const commMap = Object.fromEntries(commerciaux.map((c) => [c.id, c]));

  const caParCommercial = Object.entries(caParCommercialMap)
    .map(([id, ca]) => ({
      id,
      name: commMap[id]?.name ?? "Inconnu",
      teamType: commMap[id]?.teamType ?? null,
      ca,
    }))
    .sort((a, b) => b.ca - a.ca);

  const panierMoyenParCommercial = Object.entries(panierMoyenMap)
    .filter(([, v]) => v.nbVentes > 0)
    .map(([id, v]) => ({
      id,
      name: commMap[id]?.name ?? "Inconnu",
      teamType: commMap[id]?.teamType ?? null,
      panierMoyen: Math.round(v.totalMontant / v.nbVentes),
      nbVentes: v.nbVentes,
    }))
    .sort((a, b) => b.panierMoyen - a.panierMoyen);

  // ── CA par équipe ─────────────────────────────────────────────────────────
  const caParEquipe = { TERRAIN: 0, TELEVENTE: 0, AUTRE: 0 };
  for (const c of caParCommercial) {
    const team = c.teamType ?? null;
    if (team === "TERRAIN") caParEquipe.TERRAIN += c.ca;
    else if (team === "TELEVENTE") caParEquipe.TELEVENTE += c.ca;
    else caParEquipe.AUTRE += c.ca;
  }

  const caCurrent = Number(caCurrentMonth._sum.montant || 0) - Number(avoirCurrentMonth._sum.montant || 0);
  const caPrev    = Number(caPrevMonth._sum.montant || 0) - Number(avoirPrevMonth._sum.montant || 0);
  const variation = caPrev > 0 ? ((caCurrent - caPrev) / caPrev) * 100 : 0;

  return NextResponse.json({
    selectedPeriod: { mois: currentMonth, annee: currentYear },
    caComparaison: {
      moisCourant:   caCurrent,
      moisPrecedent: caPrev,
      variation:     Math.round(variation * 10) / 10,
    },
    top10Clients: top10,
    panierMoyen: {
      global:   Math.round(Number(panierMoyenGlobal._avg.montant || 0)),
      nbVentes: panierMoyenGlobal._count,
    },
    caParCommercial,
    panierMoyenParCommercial,
    caParEquipe: [
      { equipe: "Terrain",   ca: caParEquipe.TERRAIN,   color: "#059669" },
      { equipe: "Télévente", ca: caParEquipe.TELEVENTE,  color: "#7C3AED" },
      { equipe: "Autre",     ca: caParEquipe.AUTRE,      color: "#3B82F6" },
    ].filter((e) => e.ca > 0),
    evolutionPanierMoyen: evolutionPanierMoyen.map((e) => ({
      label:      MOIS[(e.mois as number) - 1],
      mois:       e.mois,
      annee:      e.annee,
      panierMoyen: Math.round(Number(e._avg.montant || 0)),
      nbVentes:   e._count._all,
    })),
    // Liste des mois/années disponibles dans la base (pour le sélecteur)
    moisDisponibles: moisDisponibles.map((m) => ({
      mois:  m.mois as number,
      annee: m.annee as number,
    })),
  });
}
