import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { canAccess, PERMISSIONS } from "@/lib/permissions";
import { Role } from "@prisma/client";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = session.user.role as Role;
  if (!canAccess(role, PERMISSIONS.EDIT_DATA)) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: { commercial: { select: { teamType: true } } },
  });
  if (!client) return NextResponse.json({ error: "Client introuvable" }, { status: 404 });

  // Les chefs ne peuvent modifier que les clients de leur équipe
  if (role === Role.CHEF_TERRAIN && client.commercial.teamType !== "TERRAIN") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }
  if (role === Role.CHEF_TELEVENTE && client.commercial.teamType !== "TELEVENTE") {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const { lineaire } = body;

  if (lineaire !== undefined && lineaire !== null && (typeof lineaire !== "number" || lineaire < 0)) {
    return NextResponse.json({ error: "Métrage invalide" }, { status: 400 });
  }

  const updated = await prisma.client.update({
    where: { id },
    data: { lineaire: lineaire ?? null },
    select: { id: true, lineaire: true },
  });

  return NextResponse.json(updated);
}
