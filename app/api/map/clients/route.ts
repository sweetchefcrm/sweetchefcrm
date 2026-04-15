import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDataScope } from "@/lib/permissions";
import { Role } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const dept = searchParams.get("dept") || "";
  const filter = searchParams.get("filter") || "all";
  const commercial = searchParams.get("commercial") || "";
  const etagereFilter = searchParams.get("etagere") || "";
  const categorieStatut = searchParams.get("categorieStatut") || "";
  const sousCategorie = searchParams.get("sousCategorie") || "";
  const categorieType = searchParams.get("categorieType") || "";
  const limit = parseInt(searchParams.get("limit") || "50");

  if (!dept) return NextResponse.json({ clients: [] });

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const scope = getDataScope(session.user.role as Role, session.user.id);
  const where: Record<string, unknown> = {};

  if (scope.commercialId) where.commercialId = scope.commercialId;
  if (scope.teamType) where.commercial = { teamType: scope.teamType };
  if (commercial) where.commercialId = commercial;
  if (etagereFilter === "oui") where.etagere = true;
  else if (etagereFilter === "non") where.etagere = false;
  if (categorieStatut) where.categorieStatut = { contains: categorieStatut, mode: "insensitive" };
  if (sousCategorie) where.sousCategorie = { contains: sousCategorie, mode: "insensitive" };
  if (categorieType) where.categorieType = { contains: categorieType, mode: "insensitive" };

  // Filtre par département (startsWith pour matcher tous les codes postaux du dépt)
  where.codePostal = { startsWith: dept };

  switch (filter) {
    case "actif":
      where.actif = true;
      break;
    case "inactive":
      where.actif = false;
      break;
    case "active_month":
      where.ventes = { some: { dateVente: { gte: startOfMonth } } };
      break;
    case "no_order_month":
      where.ventes = { none: { dateVente: { gte: startOfMonth } } };
      break;
    case "new": {
      const threeMonthsAgo = new Date(now);
      threeMonthsAgo.setMonth(now.getMonth() - 3);
      where.dateCreation = { gte: threeMonthsAgo };
      break;
    }
  }

  const rawClients = await prisma.client.findMany({
    where,
    include: {
      commercial: { select: { id: true, name: true, role: true } },
      ventes: { select: { montant: true } },
      _count: { select: { ventes: true } },
    },
    orderBy: { nom: "asc" },
    take: limit,
  });

  const clients = rawClients.map((c) => {
    const totalCA = c.ventes.reduce((sum, v) => sum + Number(v.montant), 0);
    const nbCommandes = c._count.ventes;
    return {
      id: c.id,
      nom: c.nom,
      codeClient: c.codeClient,
      codePostal: c.codePostal,
      categorieStatut: c.categorieStatut,
      sousCategorie: c.sousCategorie,
      etagere: c.etagere,
      panierMoyen: nbCommandes > 0 ? totalCA / nbCommandes : 0,
      commercial: c.commercial,
      _count: c._count,
    };
  });

  return NextResponse.json({ clients });
}
