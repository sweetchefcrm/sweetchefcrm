import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDataScope } from "@/lib/permissions";
import { Role } from "@prisma/client";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const scope = getDataScope(session.user.role as Role, session.user.id);

  const where: Record<string, unknown> = {};
  if (scope.commercialId) where.commercialId = scope.commercialId;
  if (scope.teamType) where.commercial = { teamType: scope.teamType };

  // Commerciaux visibles selon le scope (pour le filtre par commercial)
  // Seulement pour les rôles qui voient plusieurs commerciaux
  const canFilterByCommercial = (
    [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL, Role.CHEF_TERRAIN, Role.CHEF_TELEVENTE] as Role[]
  ).includes(session.user.role as Role);

  const [codesPostaux, types, sousCategories, commerciaux] = await Promise.all([
    prisma.client.findMany({
      where: { ...where, codePostal: { not: null } },
      select: { codePostal: true },
      distinct: ["codePostal"],
      orderBy: { codePostal: "asc" },
    }),
    prisma.client.findMany({
      where: { ...where, categorieType: { not: null } },
      select: { categorieType: true },
      distinct: ["categorieType"],
      orderBy: { categorieType: "asc" },
    }),
    prisma.client.findMany({
      where: { ...where, sousCategorie: { not: null } },
      select: { sousCategorie: true },
      distinct: ["sousCategorie"],
      orderBy: { sousCategorie: "asc" },
    }),
    canFilterByCommercial
      ? prisma.client.findMany({
          where,
          select: { commercial: { select: { id: true, name: true } } },
          distinct: ["commercialId"],
        })
      : Promise.resolve([]),
  ]);

  return NextResponse.json({
    villes: codesPostaux.map((v) => v.codePostal).filter(Boolean) as string[],
    types: types.map((t) => t.categorieType).filter(Boolean) as string[],
    sousCategories: sousCategories.map((s) => s.sousCategorie).filter(Boolean) as string[],
    commerciaux: (commerciaux as { commercial: { id: string; name: string } }[])
      .map((c) => c.commercial)
      .sort((a, b) => a.name.localeCompare(b.name, "fr")),
  });
}
