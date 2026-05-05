import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";

const ADMIN_ROLES = [Role.ADMIN, Role.COMMERCIAL_PRINCIPAL, Role.CHEF_TERRAIN, Role.CHEF_TELEVENTE];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  if (!ADMIN_ROLES.includes(session.user.role as (typeof ADMIN_ROLES)[number])) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
  const limit = 50;
  const skip = (page - 1) * limit;

  const moisStr = searchParams.get("mois");
  const anneeStr = searchParams.get("annee");
  const search = searchParams.get("search") || "";

  const where: Record<string, unknown> = {};
  if (moisStr) where.mois = parseInt(moisStr);
  if (anneeStr) where.annee = parseInt(anneeStr);
  if (search) {
    where.client = { nom: { contains: search, mode: "insensitive" } };
  }

  const [avoirs, total, moisDisponibles] = await Promise.all([
    prisma.avoir.findMany({
      where,
      include: {
        client: { select: { nom: true, codeClient: true } },
        commercial: { select: { name: true } },
      },
      orderBy: { dateAvoir: "desc" },
      skip,
      take: limit,
    }),
    prisma.avoir.count({ where }),
    prisma.avoir.groupBy({
      by: ["mois", "annee"],
      orderBy: [{ annee: "desc" }, { mois: "desc" }],
    }),
  ]);

  return NextResponse.json({
    avoirs,
    total,
    pages: Math.ceil(total / limit),
    page,
    moisDisponibles: moisDisponibles.map((m) => ({ mois: m.mois as number, annee: m.annee as number })),
  });
}
