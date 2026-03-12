import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDataScope } from "@/lib/permissions";
import { Role } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const scope = getDataScope(session.user.role as Role, session.user.id);

  // ── Récupérer les clients comme pivot (vente → client → commercial) ────────
  const allClients = await prisma.client.findMany({
    where: scope.commercialId ? { commercialId: scope.commercialId } : undefined,
    select: { id: true, commercialId: true },
  });

  const clientIds = allClients.map((c) => c.id);
  const clientToCommercial = Object.fromEntries(
    allClients.map((c) => [c.id, c.commercialId])
  );

  const venteFilter = clientIds.length > 0 ? { clientId: { in: clientIds } } : {};
  const clientFilter = scope.commercialId ? { commercialId: scope.commercialId } : {};

  // ── Requêtes parallèles ───────────────────────────────────────────────────
  const [
    caMonthResult,
    caYearResult,
    clientsActifs,
    newClientsMonth,
    prospectsCount,
    evolutionMensuelle,
    caMonthPrev,
    evolutionJournaliere,
    ventesMoisParClient, // pour CA par commercial
  ] = await Promise.all([
    prisma.vente.aggregate({
      where: { ...venteFilter, mois: now.getMonth() + 1, annee: now.getFullYear() },
      _sum: { montant: true },
    }),
    prisma.vente.aggregate({
      where: { ...venteFilter, annee: now.getFullYear() },
      _sum: { montant: true },
    }),
    prisma.client.count({ where: { ...clientFilter, actif: true } }),
    prisma.client.count({ where: { ...clientFilter, dateCreation: { gte: startOfMonth } } }),
    prisma.prospect.count({ where: { converti: false } }),
    prisma.vente.groupBy({
      by: ["mois", "annee"],
      where: {
        ...venteFilter,
        dateVente: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) },
      },
      _sum: { montant: true },
      orderBy: [{ annee: "asc" }, { mois: "asc" }],
    }),
    prisma.vente.aggregate({
      where: {
        ...venteFilter,
        mois: now.getMonth() === 0 ? 12 : now.getMonth(),
        annee: now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear(),
      },
      _sum: { montant: true },
    }),
    // Évolution journalière — mois courant
    prisma.vente.groupBy({
      by: ["dateVente"],
      where: {
        ...venteFilter,
        mois: now.getMonth() + 1,
        annee: now.getFullYear(),
      },
      _sum: { montant: true },
      orderBy: { dateVente: "asc" },
    }),
    // Ventes du mois par client → pour reconstruire CA par commercial
    prisma.vente.groupBy({
      by: ["clientId"],
      where: { ...venteFilter, mois: now.getMonth() + 1, annee: now.getFullYear() },
      _sum: { montant: true },
    }),
  ]);

  // ── Agréger CA par commercial (clientId → commercialId) ───────────────────
  const caParCommercialMap: Record<string, number> = {};
  for (const v of ventesMoisParClient) {
    const commId = clientToCommercial[v.clientId];
    if (!commId) continue;
    const ca = Number(v._sum.montant || 0);
    caParCommercialMap[commId] = (caParCommercialMap[commId] ?? 0) + ca;
  }

  const commercialIds = Object.keys(caParCommercialMap);
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

  const caMois = Number(caMonthResult._sum.montant || 0);
  const caMoisPrec = Number(caMonthPrev._sum.montant || 0);
  const evolutionPct = caMoisPrec > 0 ? ((caMois - caMoisPrec) / caMoisPrec) * 100 : 0;

  return NextResponse.json({
    caMois,
    caAnnuel: Number(caYearResult._sum.montant || 0),
    clientsActifs,
    newClientsMonth,
    prospectsCount,
    evolutionPct: Math.round(evolutionPct * 10) / 10,
    evolutionMensuelle: evolutionMensuelle.map((e) => ({
      mois: e.mois,
      annee: e.annee,
      ca: Number(e._sum.montant || 0),
    })),
    evolutionJournaliere: evolutionJournaliere.map((e) => ({
      jour: new Date(e.dateVente).getDate(),
      ca: Number(e._sum.montant || 0),
    })),
    caParCommercial,
  });
}
