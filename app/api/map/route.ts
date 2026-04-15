import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getDataScope } from "@/lib/permissions";
import { Role } from "@prisma/client";

function getDeptCode(codePostal: string): string {
  const cp = codePostal.trim();
  if (cp.startsWith("97") && cp.length >= 3) return cp.substring(0, 3);
  return cp.substring(0, 2);
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { searchParams } = req.nextUrl;
  const filter = searchParams.get("filter") || "all";
  const commercial = searchParams.get("commercial") || "";
  const etagereFilter = searchParams.get("etagere") || "";
  const categorieStatut = searchParams.get("categorieStatut") || "";
  const sousCategorie = searchParams.get("sousCategorie") || "";
  const categorieType = searchParams.get("categorieType") || "";

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

  const clients = await prisma.client.findMany({
    where,
    select: {
      codePostal: true,
      categorieStatut: true,
      etagere: true,
      ventes: { select: { montant: true } },
    },
  });

  const deptMap = new Map<
    string,
    {
      code: string;
      count: number;
      totalCA: number;
      categories: Record<string, number>;
      etagereCount: number;
    }
  >();

  for (const client of clients) {
    if (!client.codePostal) continue;
    const code = getDeptCode(client.codePostal);
    if (!code || code.length < 2) continue;

    if (!deptMap.has(code)) {
      deptMap.set(code, { code, count: 0, totalCA: 0, categories: {}, etagereCount: 0 });
    }
    const dept = deptMap.get(code)!;
    dept.count++;
    dept.totalCA += client.ventes.reduce((sum, v) => sum + Number(v.montant), 0);
    if (client.etagere) dept.etagereCount++;
    const cat = client.categorieStatut || "non classé";
    dept.categories[cat] = (dept.categories[cat] || 0) + 1;
  }

  return NextResponse.json({ departments: Array.from(deptMap.values()) });
}
