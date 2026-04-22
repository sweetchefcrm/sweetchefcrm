import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@prisma/client";

const MOIS_NOMS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function formatEur(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(n);
}

// ─── Helpers pour agréger les ventes via clientId → commercialId ─────────────
// Même logique que /api/dashboard : on passe par le client comme pivot
// afin d'attribuer chaque vente au commercial propriétaire du client.

function buildCaByCommercial(
  ventes: { clientId: string; _sum: { montant: unknown } }[],
  clientToCommercial: Map<string, string>
): Map<string, number> {
  const map = new Map<string, number>();
  for (const v of ventes) {
    const commId = clientToCommercial.get(v.clientId);
    if (!commId) continue;
    const ca = Number(v._sum.montant ?? 0);
    map.set(commId, (map.get(commId) ?? 0) + ca);
  }
  return map;
}

// GET /api/admin/objectifs?mois=4&annee=2026
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const mois = parseInt(searchParams.get("mois") || String(new Date().getMonth() + 1));
  const annee = parseInt(searchParams.get("annee") || String(new Date().getFullYear()));

  const moisPrev = mois === 1 ? 12 : mois - 1;
  const anneePrev = mois === 1 ? annee - 1 : annee;

  // ── Commerciaux actifs ────────────────────────────────────────────────────
  const commerciaux = await prisma.user.findMany({
    where: {
      role: {
        in: [
          Role.COMMERCIAL_TERRAIN,
          Role.COMMERCIAL_TELEVENTE,
          Role.COMMERCIAL_GRAND_COMPTE,
          Role.COMMERCIAL_PRINCIPAL,
          Role.CHEF_TERRAIN,
          Role.CHEF_TELEVENTE,
        ],
      },
    },
    orderBy: { name: "asc" },
  });
  const commerciauxIds = new Set(commerciaux.map((c) => c.id));

  // ── Clients : pivot clientId → commercialId (comme dashboard) ────────────
  const allClients = await prisma.client.findMany({
    select: { id: true, commercialId: true },
  });
  const allClientIds = allClients.map((c) => c.id);
  const clientToCommercial = new Map(allClients.map((c) => [c.id, c.commercialId]));

  // ── 12 derniers mois (graphique global) ──────────────────────────────────
  const douzeMoisDates = Array.from({ length: 12 }, (_, i) => {
    let m = mois - i;
    let a = annee;
    while (m <= 0) { m += 12; a--; }
    return { mois: m, annee: a };
  }).reverse();

  // CA global par mois — toutes ventes des clients listés
  const ventesGlobal = await prisma.vente.groupBy({
    by: ["mois", "annee"],
    where: {
      clientId: { in: allClientIds },
      OR: douzeMoisDates.map((d) => ({ mois: d.mois, annee: d.annee })),
    },
    _sum: { montant: true },
  });

  // N-1 même mois
  const ventesGlobalN1 = await prisma.vente.groupBy({
    by: ["mois", "annee"],
    where: {
      clientId: { in: allClientIds },
      OR: douzeMoisDates.map((d) => ({ mois: d.mois, annee: d.annee - 1 })),
    },
    _sum: { montant: true },
  });

  const globalHistoMap = new Map(
    ventesGlobal.map((v) => [`${v.mois}-${v.annee}`, Number(v._sum.montant || 0)])
  );
  const globalN1Map = new Map(
    ventesGlobalN1.map((v) => [`${v.mois}-${v.annee - 1}`, Number(v._sum.montant || 0)])
  );

  const globalHisto = douzeMoisDates.map((d) => ({
    mois: d.mois,
    annee: d.annee,
    label: `${MOIS_NOMS[d.mois - 1].slice(0, 3)} ${d.annee !== annee ? d.annee : ""}`.trim(),
    ca: globalHistoMap.get(`${d.mois}-${d.annee}`) ?? 0,
    caN1: globalN1Map.get(`${d.mois}-${d.annee}`) ?? 0,
  }));

  const pointsAvecData = globalHisto.filter((h) => h.ca > 0).slice(-6);
  const prediction = pointsAvecData.length >= 2
    ? linearRegressionNext(pointsAvecData.map((p) => p.ca))
    : 0;

  // ── CA par commercial — via clientId → commercialId ───────────────────────

  // Mois sélectionné
  const rawThisMois = await prisma.vente.groupBy({
    by: ["clientId"],
    where: { clientId: { in: allClientIds }, mois, annee },
    _sum: { montant: true },
  });

  // Mois précédent
  const rawPrev = await prisma.vente.groupBy({
    by: ["clientId"],
    where: { clientId: { in: allClientIds }, mois: moisPrev, annee: anneePrev },
    _sum: { montant: true },
  });

  // Même mois N-1
  const rawN1 = await prisma.vente.groupBy({
    by: ["clientId"],
    where: { clientId: { in: allClientIds }, mois, annee: annee - 1 },
    _sum: { montant: true },
  });

  // Historique 6 mois (pour recommandation)
  const sixMoisDates = douzeMoisDates.slice(-6);
  const rawHisto = await prisma.vente.groupBy({
    by: ["clientId", "mois", "annee"],
    where: {
      clientId: { in: allClientIds },
      OR: sixMoisDates.map((d) => ({ mois: d.mois, annee: d.annee })),
    },
    _sum: { montant: true },
  });

  // Agréger par commercialId
  const caMap    = buildCaByCommercial(rawThisMois, clientToCommercial);
  const caPrevMap = buildCaByCommercial(rawPrev,    clientToCommercial);
  const caN1Map  = buildCaByCommercial(rawN1,       clientToCommercial);

  // Historique 6 mois par commercial
  const histoByCommercial = new Map<string, Map<string, number>>();
  for (const v of rawHisto) {
    const commId = clientToCommercial.get(v.clientId);
    if (!commId || !commerciauxIds.has(commId)) continue;
    const key = `${v.mois}-${v.annee}`;
    if (!histoByCommercial.has(commId)) histoByCommercial.set(commId, new Map());
    const existing = histoByCommercial.get(commId)!.get(key) ?? 0;
    histoByCommercial.get(commId)!.set(key, existing + Number(v._sum.montant ?? 0));
  }

  // Objectifs existants
  const objectifsExistants = await prisma.objectif.findMany({
    where: { commercialId: { in: [...commerciauxIds] }, mois, annee },
  });
  const objectifsPrev = await prisma.objectif.findMany({
    where: { commercialId: { in: [...commerciauxIds] }, mois: moisPrev, annee: anneePrev },
  });
  const objMap     = new Map(objectifsExistants.map((o) => [o.commercialId, o]));
  const objPrevMap = new Map(objectifsPrev.map((o) => [o.commercialId, Number(o.montantCible)]));

  // ── Résultat par commercial ───────────────────────────────────────────────
  const result = commerciaux.map((c) => {
    const caMois   = caMap.get(c.id)    ?? 0;
    const caPrev   = caPrevMap.get(c.id) ?? 0;
    const caN1Comm = caN1Map.get(c.id)  ?? 0;
    const objectifExistant    = objMap.get(c.id)    ?? null;
    const objectifPrevMontant = objPrevMap.get(c.id) ?? 0;

    const histo = sixMoisDates.map((d) => ({
      mois: d.mois,
      annee: d.annee,
      ca: histoByCommercial.get(c.id)?.get(`${d.mois}-${d.annee}`) ?? 0,
    }));

    const recommandation = calculerRecommandation({
      histo, caPrev, caN1: caN1Comm, objectifPrevMontant, mois, annee,
    });

    return {
      user: { id: c.id, name: c.name, role: c.role, teamType: c.teamType },
      caMois,
      caPrev,
      caN1: caN1Comm,
      variation: caPrev > 0 ? ((caMois - caPrev) / caPrev) * 100 : null,
      objectif: objectifExistant
        ? {
            id: objectifExistant.id,
            montantCible: Number(objectifExistant.montantCible),
            tauxCroissance: objectifExistant.tauxCroissance,
          }
        : null,
      objectifPrevAtteint: objectifPrevMontant > 0 ? caPrev >= objectifPrevMontant : null,
      recommandation,
      histo,
    };
  });

  const caGlobalMois = result.reduce((s, c) => s + c.caMois, 0);
  const caGlobalPrev = result.reduce((s, c) => s + c.caPrev, 0);
  const caGlobalN1   = result.reduce((s, c) => s + c.caN1,   0);

  return NextResponse.json({
    commerciaux: result,
    mois,
    annee,
    global: {
      caTotal: caGlobalMois,
      caPrev: caGlobalPrev,
      caN1: caGlobalN1,
      variationPrev: caGlobalPrev > 0 ? ((caGlobalMois - caGlobalPrev) / caGlobalPrev) * 100 : null,
      variationN1:   caGlobalN1   > 0 ? ((caGlobalMois - caGlobalN1)   / caGlobalN1)   * 100 : null,
      prediction: Math.round(prediction / 100) * 100,
      histo: globalHisto,
    },
  });
}

// POST /api/admin/objectifs
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== Role.ADMIN) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const body = await req.json();
  const { commercialId, mois, annee, montantCible } = body;
  if (!commercialId || !mois || !annee || montantCible === undefined) {
    return NextResponse.json({ error: "Données manquantes" }, { status: 400 });
  }

  const montant = parseFloat(montantCible);
  if (isNaN(montant) || montant < 0) {
    return NextResponse.json({ error: "Montant invalide" }, { status: 400 });
  }

  // CA mois précédent (via clientId → commercialId, comme dashboard)
  const moisPrev = mois === 1 ? 12 : mois - 1;
  const anneePrev = mois === 1 ? annee - 1 : annee;

  const clientsOfComm = await prisma.client.findMany({
    where: { commercialId },
    select: { id: true },
  });
  const clientIds = clientsOfComm.map((c) => c.id);

  let caPrev = 0;
  if (clientIds.length > 0) {
    const agg = await prisma.vente.aggregate({
      where: { clientId: { in: clientIds }, mois: moisPrev, annee: anneePrev },
      _sum: { montant: true },
    });
    caPrev = Number(agg._sum.montant ?? 0);
  }

  const tauxCroissance = caPrev > 0 ? ((montant - caPrev) / caPrev) * 100 : null;

  const objectif = await prisma.objectif.upsert({
    where: { commercialId_mois_annee: { commercialId, mois, annee } },
    create: { commercialId, mois, annee, montantCible: montant, tauxCroissance },
    update: { montantCible: montant, tauxCroissance },
  });

  return NextResponse.json({ objectif });
}

// ─── Régression linéaire ────────────────────────────────────────────────────

function linearRegressionNext(values: number[]): number {
  const n = values.length;
  if (n < 2) return values[0] ?? 0;
  const xs = Array.from({ length: n }, (_, i) => i + 1);
  const sumX  = xs.reduce((a, b) => a + b, 0);
  const sumY  = values.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((s, x, i) => s + x * values[i], 0);
  const sumX2 = xs.reduce((s, x) => s + x * x, 0);
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;
  return Math.max(0, intercept + slope * (n + 1));
}

// ─── Recommandation ─────────────────────────────────────────────────────────

interface HistoPoint { mois: number; annee: number; ca: number }

function calculerRecommandation(params: {
  histo: HistoPoint[];
  caPrev: number;
  caN1: number;
  objectifPrevMontant: number;
  mois: number;
  annee: number;
}): { montant: number; raisonnement: string; confiance: "haute" | "moyenne" | "faible" } {
  const { histo, caPrev, caN1, objectifPrevMontant, mois } = params;
  const histoActifs = histo.filter((h) => h.ca > 0);

  if (histoActifs.length === 0) {
    return { montant: 0, raisonnement: "Aucune donnée historique.", confiance: "faible" };
  }

  const derniers3 = histoActifs.slice(-3);
  const moyenne3 = derniers3.reduce((s, h) => s + h.ca, 0) / derniers3.length;

  let tendancePct = 0;
  if (histoActifs.length >= 2) {
    const first = histoActifs[0].ca;
    const last  = histoActifs[histoActifs.length - 1].ca;
    tendancePct = first > 0 ? ((last - first) / first) * 100 : 0;
  }

  const aAtteintobjPrev = objectifPrevMontant > 0 ? caPrev >= objectifPrevMontant : null;
  let montantRecommande = moyenne3;
  const raisonnements: string[] = [];
  let confiance: "haute" | "moyenne" | "faible" = "moyenne";

  if (tendancePct > 10) {
    const bonus = Math.min(tendancePct / 2, 8);
    montantRecommande *= 1 + bonus / 100;
    raisonnements.push(`Tendance haussière (+${Math.round(tendancePct)}%) → +${Math.round(bonus)}%`);
  } else if (tendancePct < -10) {
    const malus = Math.min(Math.abs(tendancePct) / 3, 5);
    montantRecommande *= 1 - malus / 100;
    raisonnements.push(`Tendance baissière (${Math.round(tendancePct)}%) → ${-Math.round(malus)}%`);
  } else {
    raisonnements.push(`Tendance stable · base = moy. 3 mois : ${formatEur(Math.round(moyenne3))}`);
  }

  if (caN1 > 0) {
    const ratio = caN1 / (caPrev || caN1);
    if (ratio > 1.1) {
      montantRecommande = Math.max(montantRecommande, caN1 * 0.95);
      raisonnements.push(`${MOIS_NOMS[mois - 1]} N-1 fort (${formatEur(caN1)})`);
    } else if (ratio < 0.85) {
      raisonnements.push(`${MOIS_NOMS[mois - 1]} N-1 faible (${formatEur(caN1)})`);
    }
    confiance = "haute";
  }

  if (aAtteintobjPrev === false) {
    montantRecommande = Math.min(montantRecommande, caPrev * 1.05);
    raisonnements.push("Objectif préc. non atteint → objectif réaliste");
    confiance = confiance === "haute" ? "moyenne" : "faible";
  } else if (aAtteintobjPrev === true) {
    raisonnements.push("Objectif préc. atteint ✓");
  }

  return {
    montant: Math.round(montantRecommande / 100) * 100,
    raisonnement: raisonnements.join(" · "),
    confiance,
  };
}
