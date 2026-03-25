import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

// Remplir les mois manquants entre le premier et le mois courant
function fillMissingMonths(
  data: { mois: number; annee: number; ca: number }[]
): { mois: number; annee: number; ca: number }[] {
  if (data.length === 0) return [];

  const now = new Date();
  const endMois = now.getMonth() + 1;
  const endAnnee = now.getFullYear();

  const map = new Map<string, number>();
  for (const d of data) map.set(`${d.annee}-${d.mois}`, d.ca);

  const result: { mois: number; annee: number; ca: number }[] = [];
  let m = data[0].mois;
  let a = data[0].annee;

  while (a < endAnnee || (a === endAnnee && m <= endMois)) {
    result.push({ mois: m, annee: a, ca: map.get(`${a}-${m}`) ?? 0 });
    m++;
    if (m > 12) { m = 1; a++; }
  }

  return result;
}

function roleLabel(role: string): string {
  const map: Record<string, string> = {
    ADMIN: "Administrateur",
    COMMERCIAL_PRINCIPAL: "Commercial Principal",
    CHEF_TERRAIN: "Chef Terrain",
    CHEF_TELEVENTE: "Chef Télévente",
    COMMERCIAL_TERRAIN: "Commercial Terrain",
    COMMERCIAL_TELEVENTE: "Commercial Télévente",
    COMMERCIAL_GRAND_COMPTE: "Commercial Grand Compte",
    MERCHANDISEUR: "Merchandiseur",
    AUTRES: "Autres",
    DESACTIVE: "Désactivé",
  };
  return map[role] ?? role.replace(/_/g, " ");
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { id } = await params;
  const userId = id === "me" ? session.user.id : id;

  const role = session.user.role as Role;
  const COMMERCIAL_ONLY_ROLES: Role[] = [
    Role.COMMERCIAL_TERRAIN,
    Role.COMMERCIAL_TELEVENTE,
    Role.COMMERCIAL_GRAND_COMPTE,
    Role.MERCHANDISEUR,
    Role.AUTRES,
  ];
  if (COMMERCIAL_ONLY_ROLES.includes(role)) {
    if (userId !== session.user.id) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const { searchParams } = req.nextUrl;
  const now = new Date();

  const mois = parseInt(searchParams.get("mois") || String(now.getMonth() + 1));
  const annee = parseInt(searchParams.get("annee") || String(now.getFullYear()));

  const prevMonth = mois === 1 ? 12 : mois - 1;
  const prevYear = mois === 1 ? annee - 1 : annee;
  const startOfMonth = new Date(annee, mois - 1, 1);

  // ── Étape 1 : récupérer user + clients du commercial en parallèle ──────────
  const [user, allClients] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, teamType: true },
    }),
    prisma.client.findMany({
      where: { commercialId: userId },
      orderBy: { nom: "asc" },
    }),
  ]);

  if (!user) return NextResponse.json({ error: "Utilisateur non trouvé" }, { status: 404 });

  const clientIds = allClients.map((c) => c.id);

  // Filtre unique : activité de tous les clients assignés à ce commercial
  // (toutes les ventes de ses clients, quelle que soit l'attribution vendeur)
  const venteFilter = clientIds.length > 0
    ? { clientId: { in: clientIds } }
    : { clientId: "__aucun__" };

  // ── Étape 2 : toutes les agrégations en parallèle ─────────────────────────
  const [
    caMois,
    caPrec,
    clientsActifs,
    newClients,
    prospectsAdded,
    prospectsConverted,
    evolutionTousMoisRaw,
    ventesMoisParClient,
    statsParClient,
  ] = await Promise.all([
    // CA mois sélectionné
    prisma.vente.aggregate({
      where: { ...venteFilter, mois, annee },
      _sum: { montant: true },
    }),
    // CA mois précédent
    prisma.vente.aggregate({
      where: { ...venteFilter, mois: prevMonth, annee: prevYear },
      _sum: { montant: true },
    }),
    // Clients actifs du commercial
    prisma.client.count({ where: { commercialId: userId, actif: true } }),
    // Nouveaux clients ce mois
    prisma.client.count({
      where: { commercialId: userId, dateCreation: { gte: startOfMonth } },
    }),
    // Prospects ajoutés ce mois
    prisma.prospect.count({
      where: { commercialId: userId, createdAt: { gte: startOfMonth } },
    }),
    // Prospects convertis ce mois
    prisma.prospect.count({
      where: { commercialId: userId, converti: true, createdAt: { gte: startOfMonth } },
    }),
    // Évolution CA — tous les mois
    prisma.vente.groupBy({
      by: ["mois", "annee"],
      where: venteFilter,
      _sum: { montant: true },
      orderBy: [{ annee: "asc" }, { mois: "asc" }],
    }),
    // Ventes du mois groupées par client
    prisma.vente.groupBy({
      by: ["clientId"],
      where: { ...venteFilter, mois, annee },
      _sum: { montant: true },
      _count: { _all: true },
    }),
    // Dernière commande + total par client
    prisma.vente.groupBy({
      by: ["clientId"],
      where: venteFilter,
      _max: { dateVente: true },
      _sum: { montant: true },
      _count: { _all: true },
    }),
  ]);

  // ── Construire les maps clients ────────────────────────────────────────────
  const ventesMoisMap: Record<string, { ca: number; nbCommandes: number }> = {};
  for (const v of ventesMoisParClient) {
    ventesMoisMap[v.clientId] = {
      ca: Number(v._sum.montant || 0),
      nbCommandes: v._count._all,
    };
  }

  const statsMap: Record<
    string,
    { derniereCommande: Date | null; totalCommandes: number; caTotal: number }
  > = {};
  for (const s of statsParClient) {
    statsMap[s.clientId] = {
      derniereCommande: s._max.dateVente ?? null,
      totalCommandes: s._count._all,
      caTotal: Number(s._sum.montant || 0),
    };
  }

  const clients = allClients.map((c) => {
    const moisData = ventesMoisMap[c.id];
    const globalData = statsMap[c.id];
    return {
      id: c.id,
      codeClient: c.codeClient,
      nom: c.nom,
      codePostal: c.codePostal,
      actif: c.actif,
      aCommandeMois: !!moisData,
      caMois: moisData?.ca ?? 0,
      nbCommandesMois: moisData?.nbCommandes ?? 0,
      derniereCommande: globalData?.derniereCommande ?? null,
      totalCommandes: globalData?.totalCommandes ?? 0,
      caTotal: globalData?.caTotal ?? 0,
    };
  });

  // Non commandés en premier, puis par nom
  clients.sort((a, b) => {
    if (a.aCommandeMois !== b.aCommandeMois) return a.aCommandeMois ? 1 : -1;
    return a.nom.localeCompare(b.nom, "fr");
  });

  const nbCommandesMois = clients.filter((c) => c.aCommandeMois).length;
  const nbSansCommande = clients.length - nbCommandesMois;

  const caMoisN = Number(caMois._sum.montant || 0);
  const caPrecN = Number(caPrec._sum.montant || 0);
  const variation = caPrecN > 0 ? ((caMoisN - caPrecN) / caPrecN) * 100 : 0;
  const tauxConversion =
    prospectsAdded > 0 ? (prospectsConverted / prospectsAdded) * 100 : 0;

  // Remplir mois manquants pour graphe continu
  const rawEvolution = evolutionTousMoisRaw.map((e) => ({
    mois: e.mois as number,
    annee: e.annee as number,
    ca: Number(e._sum.montant || 0),
  }));
  const evolutionComplete = fillMissingMonths(rawEvolution);

  return NextResponse.json({
    user: {
      ...user,
      roleLabel: roleLabel(user.role),
    },
    moisSelectionne: { mois, annee },
    stats: {
      caMois: caMoisN,
      caPrecedent: caPrecN,
      variation: Math.round(variation * 10) / 10,
      clientsActifs,
      newClients,
      prospectsAdded,
      tauxConversion: Math.round(tauxConversion),
      totalClients: clients.length,
      nbCommandesMois,
      nbSansCommande,
    },
    evolutionTousMois: evolutionComplete,
    clients,
  });
}
