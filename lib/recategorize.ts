import prisma from "./prisma";

export type RecategorizeSummary = {
  total: number;
  byCategory: Record<string, number>;
  prospectsCreated: number;
};

/**
 * Algorithme de catégorisation basé sur les données réelles de ventes.
 *
 * Priorité :
 *  1. prospect   → 0 ventes (jamais commandé) → ajouté aussi en table Prospect
 *  2. perdus     → dernière commande > 6 mois
 *  3. nouveaux   → première commande < 3 mois ET encore actif
 *  4. stratégiques → top 20% CA parmi actifs + fréquence ≥ 1 cmd / 2 mois
 *  5. réguliers  → fréquence ≥ ~1 cmd/mois
 *  6. occasionnels → reste des actifs
 */
export async function recategorizeClients(): Promise<RecategorizeSummary> {
  const NOW = new Date();

  const clients = await prisma.client.findMany({
    include: {
      ventes: {
        select: { dateVente: true, montant: true },
        orderBy: { dateVente: "asc" },
      },
    },
  });

  type ClientStat = {
    id: string;
    nom: string;
    codePostal: string | null;
    telephone: string | null;
    commercialId: string;
    totalCA: number;
    nbCommandes: number;
    ordersPerMonth: number;
    categorieStatut: string | null;
    sousCategorie?: string; // définie uniquement pour les nouveaux
  };

  const stats: ClientStat[] = clients.map((c) => {
    const ventes = c.ventes;
    const nbCommandes = ventes.length;

    // ── Prospect : aucune vente ──────────────────────────────────────────
    if (nbCommandes === 0) {
      return {
        id: c.id,
        nom: c.nom,
        codePostal: c.codePostal,
        telephone: c.telephone,
        commercialId: c.commercialId,
        totalCA: 0,
        nbCommandes: 0,
        ordersPerMonth: 0,
        categorieStatut: "prospect",
      };
    }

    const totalCA = ventes.reduce((sum, v) => sum + Number(v.montant), 0);
    const firstVente = ventes[0].dateVente;
    const lastVente = ventes[ventes.length - 1].dateVente;

    const daysSinceFirst = Math.max(1, (NOW.getTime() - firstVente.getTime()) / 86_400_000);
    const daysSinceLast = (NOW.getTime() - lastVente.getTime()) / 86_400_000;
    const ordersPerMonth = nbCommandes / (daysSinceFirst / 30);

    const base = {
      id: c.id,
      nom: c.nom,
      codePostal: c.codePostal,
      telephone: c.telephone,
      commercialId: c.commercialId,
      totalCA,
      nbCommandes,
      ordersPerMonth,
    };

    // ── Perdus : dernière commande > 6 mois ─────────────────────────────
    if (daysSinceLast > 180) {
      return { ...base, categorieStatut: "perdus" };
    }

    // ── Nouveaux : première commande il y a < 3 mois ─────────────────────
    if (daysSinceFirst < 90) {
      const sousCategorie =
        nbCommandes === 1 ? "premier achat"
        : nbCommandes === 2 ? "en developpement"
        : "fidelisation rapide";
      return { ...base, categorieStatut: "nouveaux", sousCategorie };
    }

    // ── Actifs non encore classés (traitement en lot ci-dessous) ─────────
    return { ...base, categorieStatut: null };
  });

  // ── Stratégiques / Réguliers / Occasionnels ──────────────────────────
  // Parmi les actifs avec historique ≥ 3 mois
  const actifs = stats.filter((c) => c.categorieStatut === null);

  // Top 20% par CA total parmi ces actifs
  const sortedByCA = [...actifs].sort((a, b) => b.totalCA - a.totalCA);
  const top20Count = Math.max(1, Math.ceil(sortedByCA.length * 0.2));
  const top20Ids = new Set(sortedByCA.slice(0, top20Count).map((c) => c.id));

  for (const c of actifs) {
    // Stratégique : top 20% CA + commande au moins tous les 2 mois (0.5/mois)
    if (top20Ids.has(c.id) && c.ordersPerMonth >= 0.5) {
      c.categorieStatut = "stratégiques";
    }
    // Régulier : commande au moins mensuelle (0.75/mois ≈ tous les 40 jours)
    else if (c.ordersPerMonth >= 0.75) {
      c.categorieStatut = "réguliers";
    }
    // Occasionnel : le reste des actifs
    else {
      c.categorieStatut = "occasionnels";
    }
  }

  // ── Mise à jour en base ───────────────────────────────────────────────
  await Promise.all(
    stats.map((c) =>
      prisma.client.update({
        where: { id: c.id },
        data: {
          categorieStatut: c.categorieStatut,
          ...(c.sousCategorie !== undefined ? { sousCategorie: c.sousCategorie } : {}),
        },
      })
    )
  );

  // ── Auto-création des prospects pour les clients sans vente ───────────
  const prospectClients = stats.filter((c) => c.categorieStatut === "prospect");
  let prospectsCreated = 0;

  for (const c of prospectClients) {
    const existing = await prisma.prospect.findFirst({ where: { clientId: c.id } });
    if (!existing) {
      await prisma.prospect.create({
        data: {
          nom: c.nom,
          ville: c.codePostal,
          telephone: c.telephone,
          commercialId: c.commercialId,
          clientId: c.id,
          converti: false,
        },
      });
      prospectsCreated++;
    }
  }

  // ── Résumé ────────────────────────────────────────────────────────────
  const byCategory: Record<string, number> = {};
  for (const c of stats) {
    const cat = c.categorieStatut ?? "inconnu";
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }

  return { total: stats.length, byCategory, prospectsCreated };
}
