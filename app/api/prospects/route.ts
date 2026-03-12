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
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const scope = getDataScope(session.user.role as Role, session.user.id);
  const cf = scope.commercialId ? { commercialId: scope.commercialId } : {};

  const where: Record<string, unknown> = { ...cf };
  if (search) {
    where.OR = [
      { nom: { contains: search, mode: "insensitive" } },
      { ville: { contains: search, mode: "insensitive" } },
    ];
  }

  const [prospects, total] = await Promise.all([
    prisma.prospect.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.prospect.count({ where }),
  ]);

  return NextResponse.json({ prospects, total, page, limit, totalPages: Math.ceil(total / limit) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const body = await req.json();
  const { nom, ville, telephone, email } = body;

  if (!nom) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  const prospect = await prisma.prospect.create({
    data: {
      nom,
      ville: ville || undefined,
      telephone: telephone || undefined,
      email: email || undefined,
      commercialId: session.user.id,
    },
  });

  return NextResponse.json(prospect, { status: 201 });
}
