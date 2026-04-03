import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { Role } from "@prisma/client";
import { PLANNING, isInTerritory, round2 } from "@/lib/planning-config";

const ADMIN_ROLES: Role[] = [
  Role.ADMIN,
  Role.COMMERCIAL_PRINCIPAL,
  Role.CHEF_TERRAIN,
  Role.CHEF_TELEVENTE,
];

// Valeurs normalisées en base
const CAT_STRATEGIQUES = "stratégiques";
const CAT_REGULIERS = "réguliers";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const role = session.user.role as Role;
  const isAdmin = ADMIN_ROLES.includes(role);

  const { searchParams } = new URL(req.url);
  const rawUserId = searchParams.get("userId");
  const userId = rawUserId === "me" ? session.user.id : rawUserId;

  if (userId) {
    if (!isAdmin && session.user.id !== userId) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  } else {
    if (!isAdmin) {
      return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
    }
  }

  const allUsers = await prisma.user.findMany({
    select: { id: true, name: true, role: true, teamType: true },
  });

  const findUser = (dbName: string) =>
    allUsers.find((u) => u.name.toLowerCase() === dbName.toLowerCase()) ?? null;

  const ilyasse = findUser("ilyasse");

  const allClients = await prisma.client.findMany({
    select: {
      id: true,
      codeClient: true,
      nom: true,
      codePostal: true,
      categorieStatut: true,
      commercialId: true,
      commercial: { select: { id: true, name: true, teamType: true } },
    },
  });

  const entriesToProcess = userId
    ? PLANNING.filter((entry) => findUser(entry.dbName)?.id === userId)
    : PLANNING;

  const results = entriesToProcess.map((entry) => {
    const user = findUser(entry.dbName);

    const territory = allClients.filter((c) =>
      isInTerritory(c.codePostal, entry.departements, entry.belgique)
    );

    const nbA = territory.filter(
      (c) =>
        user &&
        c.commercialId === user.id &&
        c.categorieStatut === CAT_STRATEGIQUES
    ).length;

    const nbB = territory.filter(
      (c) =>
        user &&
        c.commercialId === user.id &&
        c.categorieStatut === CAT_REGULIERS
    ).length;

    const nbNouveaux = territory.filter(
      (c) =>
        user &&
        c.commercialId === user.id &&
        c.categorieStatut === "nouveaux"
    ).length;

    const nbMerchTV = territory.filter(
      (c) =>
        c.categorieStatut === CAT_STRATEGIQUES &&
        c.commercial.teamType === "TELEVENTE" &&
        (!user || c.commercialId !== user.id)
    ).length;

    const nbMerchIlyasse = ilyasse
      ? territory.filter((c) => c.commercialId === ilyasse.id).length
      : 0;

    const joursA = round2(nbA / 6);
    const joursB = round2(nbB / 6);
    const joursNouveaux = round2(nbNouveaux / 6);
    const joursMTV = round2(nbMerchTV / 6);
    const joursMI = round2(nbMerchIlyasse / 6);
    const totalJours = round2(joursA + joursB + joursNouveaux + joursMTV + joursMI);
    const joursLibres = round2(entry.joursDispo - totalJours);

    // Liste des clients du commercial (tous, pas seulement dans le territoire)
    const clients = userId && user
      ? allClients
          .filter((c) => c.commercialId === user.id)
          .map((c) => ({
            id: c.id,
            codeClient: c.codeClient,
            nom: c.nom,
            codePostal: c.codePostal,
            categorieStatut: c.categorieStatut,
            dansTerritory: isInTerritory(c.codePostal, entry.departements, entry.belgique),
          }))
          .sort((a, b) => {
            const order = [
              "stratégiques",
              "réguliers",
              "nouveaux",
              "occasionnels",
              "perdus",
              "prospect",
            ];
            const ai = order.indexOf(a.categorieStatut ?? "");
            const bi = order.indexOf(b.categorieStatut ?? "");
            const ia = ai === -1 ? 99 : ai;
            const ib = bi === -1 ? 99 : bi;
            if (ia !== ib) return ia - ib;
            return a.nom.localeCompare(b.nom, "fr");
          })
      : undefined;

    return {
      displayName: entry.displayName,
      dbName: entry.dbName,
      departements: entry.departements,
      belgique: entry.belgique,
      joursDispo: entry.joursDispo,
      userId: user?.id ?? null,
      nbA,
      nbB,
      nbNouveaux,
      nbMerchTV,
      nbMerchIlyasse,
      joursA,
      joursB,
      joursNouveaux,
      joursMTV,
      joursMI,
      totalJours,
      joursLibres,
      clients,
    };
  });

  return NextResponse.json(results);
}
