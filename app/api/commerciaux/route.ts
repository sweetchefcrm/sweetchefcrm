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

  // 2. CA du mois par commercial
  const caMoisGrouped = await prisma.vente.groupBy({
    by: ["commercialId"],
    where: { commercialId: { in: ids }, mois, annee },
    _sum: { montant: true },
  });

  // 3. CA mois précédent par commercial
  const caPrecGrouped = await prisma.vente.groupBy({
    by: ["commercialId"],
    where: { commercialId: { in: ids }, mois: prevMois, annee: prevAnnee },
    _sum: { montant: true },
  });

  // 4. Nombre de clients actifs par commercial
  const clientsActifsGrouped = await prisma.client.groupBy({
    by: ["commercialId"],
    where: { commercialId: { in: ids }, actif: true },
    _count: { _all: true },
  });

  // 5. Nombre total de clients par commercial
  const totalClientsGrouped = await prisma.client.groupBy({
    by: ["commercialId"],
    where: { commercialId: { in: ids } },
    _count: { _all: true },
  });

  // 6. Clients distincts ayant commandé ce mois par commercial
  const ventesMois = await prisma.vente.findMany({
    where: { commercialId: { in: ids }, mois, annee },
    select: { commercialId: true, clientId: true },
  });

  // Build maps
  const caMoisMap = new Map<string, number>();
  for (const v of caMoisGrouped) {
    caMoisMap.set(v.commercialId, Number(v._sum.montant || 0));
  }

  const caPrecMap = new Map<string, number>();
  for (const v of caPrecGrouped) {
    caPrecMap.set(v.commercialId, Number(v._sum.montant || 0));
  }

  const clientsActifsMap = new Map<string, number>();
  for (const c of clientsActifsGrouped) {
    clientsActifsMap.set(c.commercialId, c._count._all);
  }

  const totalClientsMap = new Map<string, number>();
  for (const c of totalClientsGrouped) {
    totalClientsMap.set(c.commercialId, c._count._all);
  }

  const commandesMap = new Map<string, Set<string>>();
  for (const v of ventesMois) {
    if (!commandesMap.has(v.commercialId)) commandesMap.set(v.commercialId, new Set());
    commandesMap.get(v.commercialId)!.add(v.clientId);
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
