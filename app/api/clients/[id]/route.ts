import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { canAccess, PERMISSIONS } from "@/lib/permissions";

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
  const { nom, codePostal, telephone, categorieStatut, categorieType, actif, etagere, commercialId } = body;

  const data: Record<string, unknown> = {};
  if (nom !== undefined) data.nom = nom;
  if (codePostal !== undefined) data.codePostal = codePostal;
  if (telephone !== undefined) data.telephone = telephone;
  if (categorieStatut !== undefined) data.categorieStatut = categorieStatut || null;
  if (categorieType !== undefined) data.categorieType = categorieType || null;
  if (actif !== undefined) data.actif = actif;
  if (etagere !== undefined) data.etagere = etagere;
  // Seul l'admin peut changer le commercial
  if (commercialId !== undefined && role === Role.ADMIN) data.commercialId = commercialId;

  const updated = await prisma.client.update({
    where: { id },
    data,
    include: { commercial: { select: { id: true, name: true, role: true } } },
  });

  return NextResponse.json(updated);
}
