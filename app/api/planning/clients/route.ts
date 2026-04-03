import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { PLANNING, isInTerritory } from "@/lib/planning-config";

const ADMIN_ROLES: Role[] = [
  Role.ADMIN,
  Role.COMMERCIAL_PRINCIPAL,
  Role.CHEF_TERRAIN,
  Role.CHEF_TELEVENTE,
];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = session.user.role as Role;
  const isAdmin = ADMIN_ROLES.includes(role);

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  // Un commercial peut accéder à son propre planning
  if (!isAdmin && session.user.id !== userId)
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  const type = searchParams.get("type"); // A | B | nouveaux | merchTV | merchIlyasse

  if (!userId || !type)
    return NextResponse.json({ error: "Paramètres manquants" }, { status: 400 });

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, teamType: true },
  });

  const user = allUsers.find((u) => u.id === userId);
  if (!user) return NextResponse.json({ error: "Commercial introuvable" }, { status: 404 });

  const planningEntry = PLANNING.find(
    (e) =>
      allUsers.find((u) => u.name.toLowerCase() === e.dbName.toLowerCase())?.id === userId
  );
  if (!planningEntry)
    return NextResponse.json({ error: "Pas de planning pour ce commercial" }, { status: 404 });

  const ilyasse = allUsers.find((u) => u.name.toLowerCase() === "ilyasse") ?? null;

  const allClients = await prisma.client.findMany({
    select: {
      id: true,
      codeClient: true,
      nom: true,
      telephone: true,
      codePostal: true,
      categorieStatut: true,
      commercialId: true,
      commercial: { select: { id: true, teamType: true } },
    },
  });

  const territory = allClients.filter((c) =>
    isInTerritory(c.codePostal, planningEntry.departements, planningEntry.belgique)
  );

  let filtered: typeof territory = [];
  switch (type) {
    case "A":
      filtered = territory.filter(
        (c) => c.commercialId === userId && c.categorieStatut === "stratégiques"
      );
      break;
    case "B":
      filtered = territory.filter(
        (c) => c.commercialId === userId && c.categorieStatut === "réguliers"
      );
      break;
    case "nouveaux":
      filtered = territory.filter(
        (c) => c.commercialId === userId && c.categorieStatut === "nouveaux"
      );
      break;
    case "merchTV":
      filtered = territory.filter(
        (c) =>
          c.categorieStatut === "stratégiques" &&
          c.commercial.teamType === "TELEVENTE" &&
          c.commercialId !== userId
      );
      break;
    case "merchIlyasse":
      if (ilyasse) {
        filtered = territory.filter((c) => c.commercialId === ilyasse.id);
      }
      break;
    default:
      return NextResponse.json({ error: "Type invalide" }, { status: 400 });
  }

  const clients = filtered
    .map((c) => ({
      id: c.id,
      codeClient: c.codeClient,
      nom: c.nom,
      telephone: c.telephone,
      codePostal: c.codePostal,
      categorieStatut: c.categorieStatut,
    }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr"));

  return NextResponse.json({ clients });
}
