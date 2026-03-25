import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role, TeamType } from "@prisma/client";

const ALLOWED_ROLES: Role[] = [
  Role.ADMIN,
  Role.COMMERCIAL_PRINCIPAL,
  Role.CHEF_TERRAIN,
  Role.CHEF_TELEVENTE,
];

const COMMERCIAL_ROLES: Role[] = [
  Role.COMMERCIAL_TERRAIN,
  Role.COMMERCIAL_TELEVENTE,
  Role.CHEF_TERRAIN,
  Role.CHEF_TELEVENTE,
  Role.COMMERCIAL_GRAND_COMPTE,
  Role.MERCHANDISEUR,
  Role.AUTRES,
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = session.user.role as Role;
  if (!ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const now = new Date();
  const mois = parseInt(searchParams.get("mois") || String(now.getMonth() + 1));
  const annee = parseInt(searchParams.get("annee") || String(now.getFullYear()));
  const sortBy = searchParams.get("sortBy") || "name";
  const sortOrder = searchParams.get("sortOrder") === "desc" ? "desc" : "asc";

  const prevMois = mois === 1 ? 12 : mois - 1;
  const prevAnnee = mois === 1 ? annee - 1 : annee;

  // Scope par équipe pour les chefs
  const teamFilter: { teamType?: TeamType } = {};
  if (role === Role.CHEF_TERRAIN) teamFilter.teamType = TeamType.TERRAIN;
  if (role === Role.CHEF_TELEVENTE) teamFilter.teamType = TeamType.TELEVENTE;

  // 1. Récupérer les commerciaux (filtrés par équipe si chef)
  const commerciaux = await prisma.user.findMany({
    where: { role: { in: COMMERCIAL_ROLES }, ...teamFilter },
    select: { id: true, name: true, role: true, teamType: true },
    orderBy: { name: "asc" },
  });

  if (commerciaux.length === 0) {
    return NextResponse.json({ commerciaux: [], totaux: { nbCommerciaux: 0, caTotal: 0, tauxMoyen: 0 } });
  }

  const ids = commerciaux.map((c) => c.id);

  // 2. Tous les clients assignés à ces commerciaux + leurs stats (actif, total)
  const [allClients, clientsActifsGrouped, totalClientsGrouped] = await Promise.all([
    prisma.client.findMany({
      where: { commercialId: { in: ids } },
      select: { id: true, commercialId: true },
    }),
    prisma.client.groupBy({
      by: ["commercialId"],
      where: { commercialId: { in: ids }, actif: true },
      _count: { _all: true },
    }),
    prisma.client.groupBy({
      by: ["commercialId"],
      where: { commercialId: { in: ids } },
      _count: { _all: true },
    }),
  ]);

  // Map clientId → commercialId (pour rattacher chaque vente à son commercial)
  const clientToCommercial = new Map(allClients.map((c) => [c.id, c.commercialId]));
  const allClientIds = allClients.map((c) => c.id);

  // 3. Ventes du mois et du mois précédent via clientId (toutes ventes des clients assignés)
  const [ventesMois, ventesPrev] = await Promise.all([
    allClientIds.length > 0
      ? prisma.vente.findMany({
          where: { clientId: { in: allClientIds }, mois, annee },
          select: { clientId: true, montant: true },
        })
      : Promise.resolve([]),
    allClientIds.length > 0
      ? prisma.vente.findMany({
          where: { clientId: { in: allClientIds }, mois: prevMois, annee: prevAnnee },
          select: { clientId: true, montant: true },
        })
      : Promise.resolve([]),
  ]);

  // Build maps
  const caMoisMap = new Map<string, number>();
  const caPrecMap = new Map<string, number>();
  const commandesMap = new Map<string, Set<string>>(); // commercialId → set de clientIds

  for (const v of ventesMois) {
    const commercialId = clientToCommercial.get(v.clientId);
    if (!commercialId) continue;
    caMoisMap.set(commercialId, (caMoisMap.get(commercialId) ?? 0) + Number(v.montant));
    if (!commandesMap.has(commercialId)) commandesMap.set(commercialId, new Set());
    commandesMap.get(commercialId)!.add(v.clientId);
  }

  for (const v of ventesPrev) {
    const commercialId = clientToCommercial.get(v.clientId);
    if (!commercialId) continue;
    caPrecMap.set(commercialId, (caPrecMap.get(commercialId) ?? 0) + Number(v.montant));
  }

  const clientsActifsMap = new Map<string, number>();
  for (const c of clientsActifsGrouped) {
    clientsActifsMap.set(c.commercialId, c._count._all);
  }

  const totalClientsMap = new Map<string, number>();
  for (const c of totalClientsGrouped) {
    totalClientsMap.set(c.commercialId, c._count._all);
  }

  // Assembler
  let result = commerciaux.map((user) => {
    const caMois = caMoisMap.get(user.id) ?? 0;
    const caPrecedent = caPrecMap.get(user.id) ?? 0;
    const variation = caPrecedent > 0 ? Math.round(((caMois - caPrecedent) / caPrecedent) * 1000) / 10 : 0;
    const clientsActifs = clientsActifsMap.get(user.id) ?? 0;
    const totalClients = totalClientsMap.get(user.id) ?? 0;
    const nbCommandesMois = commandesMap.get(user.id)?.size ?? 0;
    const taux = totalClients > 0 ? Math.round((nbCommandesMois / totalClients) * 100) : 0;

    return {
      user: { id: user.id, name: user.name, role: user.role, teamType: user.teamType },
      caMois,
      caPrecedent,
      variation,
      clientsActifs,
      totalClients,
      nbCommandesMois,
      taux,
    };
  });

  // Tri côté serveur
  result.sort((a, b) => {
    let diff = 0;
    if (sortBy === "caMois") diff = a.caMois - b.caMois;
    else if (sortBy === "taux") diff = a.taux - b.taux;
    else diff = a.user.name.localeCompare(b.user.name, "fr");
    return sortOrder === "desc" ? -diff : diff;
  });

  const caTotal = result.reduce((s, c) => s + c.caMois, 0);
  const tauxMoyen =
    result.length > 0
      ? Math.round(result.reduce((s, c) => s + c.taux, 0) / result.length)
      : 0;

  return NextResponse.json({
    commerciaux: result,
    totaux: { nbCommerciaux: result.length, caTotal, tauxMoyen },
  });
}
