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

  const moisCourant = now.getMonth() + 1;
  const anneeCourante = now.getFullYear();
  const moisPrec = moisCourant === 1 ? 12 : moisCourant - 1;
  const anneePrec = moisCourant === 1 ? anneeCourante - 1 : anneeCourante;
  const avoirFilter = clientIds.length > 0 ? { clientId: { in: clientIds } } : {};

  // ── Requêtes parallèles ───────────────────────────────────────────────────
  const [
    caMonthResult,
    caYearResult,
    avoirMoisResult,
    avoirAnneeResult,
    clientsActifs,
    newClientsMonth,
    prospectsCount,
    evolutionMensuelle,
    evolutionMensuelleavoirs,
    caMonthPrev,
    avoirPrevResult,
    evolutionJournaliere,
    evolutionJournaliereAvoirs,
    ventesMoisParClient,
    avoirsMoisParClient,
  ] = await Promise.all([
    prisma.vente.aggregate({
      where: { ...venteFilter, mois: moisCourant, annee: anneeCourante },
      _sum: { montant: true },
    }),
    prisma.vente.aggregate({
      where: { ...venteFilter, annee: anneeCourante },
      _sum: { montant: true },
    }),
    prisma.avoir.aggregate({
      where: { ...avoirFilter, mois: moisCourant, annee: anneeCourante },
      _sum: { montant: true },
    }),
    prisma.avoir.aggregate({
      where: { ...avoirFilter, annee: anneeCourante },
      _sum: { montant: true },
    }),
    prisma.client.count({ where: { ...clientFilter, actif: true } }),
    prisma.client.count({ where: { ...clientFilter, dateCreation: { gte: startOfMonth } } }),
    prisma.prospect.count({ where: { converti: false } }),
    prisma.vente.groupBy({
      by: ["mois", "annee"],
      where: {
        ...venteFilter,
        dateVente: { gte: new Date(anneeCourante - 1, now.getMonth(), 1) },
      },
      _sum: { montant: true },
      orderBy: [{ annee: "asc" }, { mois: "asc" }],
    }),
    prisma.avoir.groupBy({
      by: ["mois", "annee"],
      where: {
        ...avoirFilter,
        dateAvoir: { gte: new Date(anneeCourante - 1, now.getMonth(), 1) },
      },
      _sum: { montant: true },
      orderBy: [{ annee: "asc" }, { mois: "asc" }],
    }),
    prisma.vente.aggregate({
      where: { ...venteFilter, mois: moisPrec, annee: anneePrec },
      _sum: { montant: true },
    }),
    prisma.avoir.aggregate({
      where: { ...avoirFilter, mois: moisPrec, annee: anneePrec },
      _sum: { montant: true },
    }),
    // Évolution journalière — mois courant
    prisma.vente.groupBy({
      by: ["dateVente"],
      where: { ...venteFilter, mois: moisCourant, annee: anneeCourante },
      _sum: { montant: true },
      orderBy: { dateVente: "asc" },
    }),
    prisma.avoir.groupBy({
      by: ["dateAvoir"],
      where: { ...avoirFilter, mois: moisCourant, annee: anneeCourante },
      _sum: { montant: true },
    }),
    // Ventes du mois par client → pour reconstruire CA par commercial
    prisma.vente.groupBy({
      by: ["clientId"],
      where: { ...venteFilter, mois: moisCourant, annee: anneeCourante },
      _sum: { montant: true },
    }),
    prisma.avoir.groupBy({
      by: ["clientId"],
      where: { ...avoirFilter, mois: moisCourant, annee: anneeCourante },
      _sum: { montant: true },
    }),
  ]);

  // ── Avoirs par client (mois courant) pour déduire du CA commercial ────────
  const avoirsParClientMap: Record<string, number> = {};
  for (const a of avoirsMoisParClient) {
    avoirsParClientMap[a.clientId] = Number(a._sum.montant || 0);
  }

  // ── Agréger CA net par commercial (clientId → commercialId) ───────────────
  const caParCommercialMap: Record<string, number> = {};
  for (const v of ventesMoisParClient) {
    const commId = clientToCommercial[v.clientId];
    if (!commId) continue;
    const ca = Number(v._sum.montant || 0) - (avoirsParClientMap[v.clientId] ?? 0);
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

  // ── CA nets (ventes - avoirs) ─────────────────────────────────────────────
  const caMois = Number(caMonthResult._sum.montant || 0) - Number(avoirMoisResult._sum.montant || 0);
  const caAnnuel = Number(caYearResult._sum.montant || 0) - Number(avoirAnneeResult._sum.montant || 0);
  const caMoisPrec = Number(caMonthPrev._sum.montant || 0) - Number(avoirPrevResult._sum.montant || 0);
  const evolutionPct = caMoisPrec > 0 ? ((caMois - caMoisPrec) / caMoisPrec) * 100 : 0;

  // ── Évolution mensuelle nette ─────────────────────────────────────────────
  const avoirsMensuelsMap: Record<string, number> = {};
  for (const a of evolutionMensuelleavoirs) {
    const key = `${a.annee}-${a.mois}`;
    avoirsMensuelsMap[key] = Number(a._sum.montant || 0);
  }

  // ── Évolution journalière nette ────────────────────────────────────────────
  const avoirsJoursMap: Record<number, number> = {};
  for (const a of evolutionJournaliereAvoirs) {
    const jour = new Date(a.dateAvoir).getDate();
    avoirsJoursMap[jour] = (avoirsJoursMap[jour] ?? 0) + Number(a._sum.montant || 0);
  }

  return NextResponse.json({
    caMois,
    caAnnuel,
    clientsActifs,
    newClientsMonth,
    prospectsCount,
    evolutionPct: Math.round(evolutionPct * 10) / 10,
    evolutionMensuelle: evolutionMensuelle.map((e) => {
      const key = `${e.annee}-${e.mois}`;
      const avoirsMois = avoirsMensuelsMap[key] ?? 0;
      return {
        mois: e.mois,
        annee: e.annee,
        ca: Math.max(0, Number(e._sum.montant || 0) - avoirsMois),
      };
    }),
    evolutionJournaliere: evolutionJournaliere.map((e) => {
      const jour = new Date(e.dateVente).getDate();
      return {
        jour,
        ca: Math.max(0, Number(e._sum.montant || 0) - (avoirsJoursMap[jour] ?? 0)),
      };
    }),
    caParCommercial,
  });
}
