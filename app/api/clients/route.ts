import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDataScope } from "@/lib/permissions";
import { Role } from "@prisma/client";

const ALLOWED_SORT_FIELDS: Record<string, string> = {
  nom: "nom",
  codeClient: "codeClient",
  codePostal: "codePostal",
  categorieStatut: "categorieStatut",
  etagere: "etagere",
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const filter = searchParams.get("filter") || "all";
  const commercial = searchParams.get("commercial") || "";
  const search = searchParams.get("search") || "";
  const etagereFilter = searchParams.get("etagere") || "";
  const categorieStatutFilter = searchParams.get("categorieStatut") || "";
  const categorieTypeFilter = searchParams.get("categorieType") || "";
  const codePostalFilter = searchParams.get("ville") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const sortByRaw = searchParams.get("sortBy") || "nom";
  const sortOrder = searchParams.get("sortOrder") === "desc" ? "desc" : "asc";
  const sortBy = ALLOWED_SORT_FIELDS[sortByRaw] || "nom";

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const scope = getDataScope(session.user.role as Role, session.user.id);
  const commercialFilter = scope.commercialId ? { commercialId: scope.commercialId } : {};

  let where: Record<string, unknown> = { ...commercialFilter };

  // Scope par équipe pour les chefs
  if (scope.teamType) {
    where.commercial = { teamType: scope.teamType };
  }

  if (commercial) where.commercialId = commercial;
  if (codePostalFilter) where.codePostal = { contains: codePostalFilter, mode: "insensitive" };
  if (search) {
    where.OR = [
      { nom: { contains: search, mode: "insensitive" } },
      { codeClient: { contains: search, mode: "insensitive" } },
      { codePostal: { contains: search, mode: "insensitive" } },
    ];
  }

  // Filtre étagère
  if (etagereFilter === "oui") where.etagere = true;
  else if (etagereFilter === "non") where.etagere = false;

  // Filtres catégorie
  if (categorieStatutFilter) {
    where.categorieStatut = { contains: categorieStatutFilter, mode: "insensitive" };
  }
  if (categorieTypeFilter) {
    where.categorieType = { contains: categorieTypeFilter, mode: "insensitive" };
  }

  // Filtres métier
  switch (filter) {
    case "active_month":
      where.ventes = { some: { dateVente: { gte: startOfMonth } } };
      break;
    case "no_order_month":
      where.ventes = { none: { dateVente: { gte: startOfMonth } } };
      break;
    case "inactive":
      where.actif = false;
      break;
    case "new":
      where.dateCreation = { gte: startOfMonth };
      break;
    case "actif":
      where.actif = true;
      break;
  }

  const [clients, total] = await Promise.all([
    prisma.client.findMany({
      where,
      include: {
        commercial: { select: { id: true, name: true, role: true } },
        ventes: {
          orderBy: { dateVente: "desc" },
          take: 1,
          select: { dateVente: true, montant: true },
        },
        _count: { select: { ventes: true } },
      },
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.client.count({ where }),
  ]);

  return NextResponse.json({ clients, total, page, limit, totalPages: Math.ceil(total / limit) });
}
