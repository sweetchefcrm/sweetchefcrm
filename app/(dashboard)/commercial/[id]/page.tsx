"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Header from "@/components/layout/Header";
import KPICard from "@/components/dashboard/KPICard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import {
  Euro,
  Users,
  TrendingUp,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  MapPin,
  Phone,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Hash,
  X,
  Target,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const MOIS_NOMS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Clients stratégiques": "bg-blue-100 text-blue-800",
  "Clients réguliers":    "bg-green-100 text-green-800",
  "Clients occasionnels": "bg-amber-100 text-amber-800",
  "Nouveaux clients":     "bg-violet-100 text-violet-800",
  "Clients perdus":       "bg-red-100 text-red-800",
  "Prospect":             "bg-gray-100 text-gray-500",
};

const STATUT_STYLES: Record<string, string> = {
  "strategique":  "bg-blue-100 text-blue-800",
  "stratégique":  "bg-blue-100 text-blue-800",
  "regulier":     "bg-green-100 text-green-800",
  "régulier":     "bg-green-100 text-green-800",
  "occasionnel":  "bg-amber-100 text-amber-800",
  "nouveau":      "bg-violet-100 text-violet-800",
  "perdus":       "bg-red-100 text-red-800",
  "prospect":     "bg-gray-100 text-gray-500",
};

const SOUS_CAT_STYLES: Record<string, string> = {
  "tres frequent":       "bg-blue-200 text-blue-900",
  "frequent":            "bg-blue-100 text-blue-700",
  "rare":                "bg-amber-100 text-amber-700",
  "tres regulier":       "bg-green-200 text-green-900",
  "peu regulier":        "bg-green-100 text-green-700",
  "peu frequent":        "bg-yellow-100 text-yellow-700",
  "tres rare":           "bg-orange-100 text-orange-700",
  "fidelisation rapide": "bg-violet-200 text-violet-900",
  "premier achat":       "bg-gray-100 text-gray-500",
  "en developpement":    "bg-sky-100 text-sky-700",
};

function statutStyle(statut: string): string {
  const lower = statut.toLowerCase();
  for (const [key, cls] of Object.entries(STATUT_STYLES)) {
    if (lower.includes(key)) return cls;
  }
  return "bg-gray-100 text-gray-500";
}

function sousCatStyle(sousCat: string): string {
  const lower = sousCat.toLowerCase();
  for (const [key, cls] of Object.entries(SOUS_CAT_STYLES)) {
    if (lower.includes(key)) return cls;
  }
  return "bg-gray-100 text-gray-500";
}

interface PlanningClient {
  id: string;
  codeClient: string;
  nom: string;
  codePostal: string | null;
  categorieStatut: string | null;
  dansTerritory: boolean;
}

interface PlanningRow {
  displayName: string;
  departements: string[];
  belgique: boolean;
  joursDispo: number;
  userId: string | null;
  nbA: number;
  nbB: number;
  nbNouveaux: number;
  nbMerchTV: number;
  nbMerchIlyasse: number;
  joursA: number;
  joursB: number;
  joursNouveaux: number;
  joursMTV: number;
  joursMI: number;
  totalJours: number;
  joursLibres: number;
  clients?: PlanningClient[];
}

interface PanelClient {
  id: string;
  codeClient: string;
  nom: string;
  telephone: string | null;
  codePostal: string | null;
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

interface ClientRow {
  id: string;
  codeClient: string;
  nom: string;
  codePostal?: string;
  actif: boolean;
  categorieStatut?: string | null;
  sousCategorie?: string | null;
  aCommandeMois: boolean;
  caMois: number;
  nbCommandesMois: number;
  derniereCommande: string | null;
  totalCommandes: number;
  caTotal: number;
}

interface CommercialData {
  user: { name: string; role: string; teamType: string | null; roleLabel: string };
  moisSelectionne: { mois: number; annee: number };
  stats: {
    caMois: number;
    caPrecedent: number;
    variation: number;
    clientsActifs: number;
    newClients: number;
    prospectsAdded: number;
    tauxConversion: number;
    totalClients: number;
    nbCommandesMois: number;
    nbSansCommande: number;
  };
  evolutionTousMois: { mois: number; annee: number; ca: number }[];
  clients: ClientRow[];
}

function TeamBadge({ teamType }: { teamType: string | null }) {
  if (!teamType) return null;
  const isTerrain = teamType === "TERRAIN";
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${
        isTerrain
          ? "bg-emerald-100 text-emerald-700"
          : "bg-violet-100 text-violet-700"
      }`}
    >
      {isTerrain ? (
        <MapPin className="w-3 h-3" />
      ) : (
        <Phone className="w-3 h-3" />
      )}
      {isTerrain ? "Terrain" : "Télévente"}
    </span>
  );
}

export default function CommercialPage() {
  const { id } = useParams<{ id: string }>();
  const now = new Date();
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());
  // Navigation max : 1 mois dans le futur (pour voir les objectifs à venir)
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const maxMois = nextMonthDate.getMonth() + 1;
  const maxAnnee = nextMonthDate.getFullYear();
  const [data, setData] = useState<CommercialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "commande" | "pas_commande">("tous");
  const [filtreCat, setFiltreCat] = useState("");
  const [filtreSousCat, setFiltreSousCat] = useState("");
  const [filtreActif, setFiltreActif] = useState<"tous" | "actif" | "inactif">("tous");
  const [sortField, setSortField] = useState<string>("commande");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const autoNavRef = useRef<string>(""); // id du commercial pour lequel l'auto-nav a déjà eu lieu
  const [tab, setTab] = useState<"performances" | "planning">("performances");
  const [planningData, setPlanningData] = useState<PlanningRow[] | null>(null);
  const [planningLoading, setPlanningLoading] = useState(false);

  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTitle, setPanelTitle] = useState("");
  const [panelClients, setPanelClients] = useState<PanelClient[]>([]);
  const [panelLoading, setPanelLoading] = useState(false);
  const [objectif, setObjectif] = useState<{ montantCible: number; tauxCroissance: number | null } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/commercial/${id}?mois=${mois}&annee=${annee}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
    // Charger l'objectif du mois
    fetch(`/api/objectifs?commercialId=${id}&mois=${mois}&annee=${annee}`)
      .then((r) => r.json())
      .then((d) => setObjectif(d.objectif ?? null))
      .catch(() => setObjectif(null));
  }, [id, mois, annee]);

  // Auto-navigation : si le mois courant n'a pas de données, aller au dernier mois avec données
  useEffect(() => {
    if (!data || autoNavRef.current === id) return;

    const isCurrentMonth =
      mois === now.getMonth() + 1 && annee === now.getFullYear();
    if (!isCurrentMonth) return;

    const hasNoData =
      data.stats.caMois === 0 && data.stats.nbCommandesMois === 0;
    if (!hasNoData) return;

    const lastWithData = [...data.evolutionTousMois]
      .reverse()
      .find((e) => e.ca > 0);

    if (
      lastWithData &&
      (lastWithData.mois !== mois || lastWithData.annee !== annee)
    ) {
      autoNavRef.current = id;
      setMois(lastWithData.mois);
      setAnnee(lastWithData.annee);
    }
  }, [data, id, mois, annee]);

  function naviguerMois(delta: number) {
    let m = mois + delta;
    let a = annee;
    if (m > 12) { m = 1; a++; }
    if (m < 1) { m = 12; a--; }
    setMois(m);
    setAnnee(a);
  }

  async function openPanel(userId: string, type: string, label: string) {
    setPanelTitle(label);
    setPanelOpen(true);
    setPanelLoading(true);
    setPanelClients([]);
    const res = await fetch(`/api/planning/clients?userId=${userId}&type=${type}`);
    const data = await res.json();
    setPanelClients(data.clients ?? []);
    setPanelLoading(false);
  }

  function handleTabPlanning() {
    setTab("planning");
    if (planningData === null && !planningLoading) {
      setPlanningLoading(true);
      const uid = `?userId=${id}`;
      fetch(`/api/planning${uid}`)
        .then((r) => r.json())
        .then((rows) => setPlanningData(Array.isArray(rows) ? rows : []))
        .catch(() => setPlanningData([]))
        .finally(() => setPlanningLoading(false));
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#1E40AF]" />
      </div>
    );
  }

  const stats = data?.stats;
  const evolution = data?.evolutionTousMois;
  const user = data?.user;

  function handleSort(field: string) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  const clientsFiltres = (() => {
    let list = (data?.clients || []).filter((c) => {
      if (
        search &&
        !c.nom.toLowerCase().includes(search.toLowerCase()) &&
        !c.codeClient.toLowerCase().includes(search.toLowerCase())
      ) return false;
      if (filtre === "commande" && !c.aCommandeMois) return false;
      if (filtre === "pas_commande" && c.aCommandeMois) return false;
      if (filtreCat && c.categorieStatut?.toLowerCase() !== filtreCat.toLowerCase()) return false;
      if (filtreSousCat && c.sousCategorie?.toLowerCase() !== filtreSousCat.toLowerCase()) return false;
      if (filtreActif === "actif" && !c.actif) return false;
      if (filtreActif === "inactif" && c.actif) return false;
      return true;
    });

    list = [...list].sort((a, b) => {
      let diff = 0;
      switch (sortField) {
        case "nom":       diff = a.nom.localeCompare(b.nom, "fr"); break;
        case "codeClient":diff = a.codeClient.localeCompare(b.codeClient); break;
        case "codePostal":diff = (a.codePostal || "").localeCompare(b.codePostal || ""); break;
        case "categorieStatut": diff = (a.categorieStatut || "").localeCompare(b.categorieStatut || ""); break;
        case "sousCategorie":   diff = (a.sousCategorie || "").localeCompare(b.sousCategorie || ""); break;
        case "commande":  diff = (a.aCommandeMois === b.aCommandeMois ? 0 : a.aCommandeMois ? -1 : 1); break;
        case "caMois":    diff = a.caMois - b.caMois; break;
        case "derniereCommande": {
          const ta = a.derniereCommande ? new Date(a.derniereCommande).getTime() : 0;
          const tb = b.derniereCommande ? new Date(b.derniereCommande).getTime() : 0;
          diff = ta - tb; break;
        }
        case "totalCommandes": diff = a.totalCommandes - b.totalCommandes; break;
        case "actif": diff = (a.actif === b.actif ? 0 : a.actif ? -1 : 1); break;
      }
      return sortDir === "asc" ? diff : -diff;
    });

    return list;
  })();

  // Valeurs uniques pour les filtres dropdown
  const uniqueCategories = [...new Set((data?.clients || []).map(c => c.categorieStatut).filter(Boolean))] as string[];
  const uniqueSousCategories = [...new Set((data?.clients || []).map(c => c.sousCategorie).filter(Boolean))] as string[];

  const tauxCommande =
    stats && stats.totalClients > 0
      ? Math.round((stats.nbCommandesMois / stats.totalClients) * 100)
      : 0;

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Header
            title={user?.name || "Mes Performances"}
            subtitle={user?.roleLabel}
          />
          {user?.teamType && <TeamBadge teamType={user.teamType} />}
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <button
            onClick={() => naviguerMois(-1)}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-800 w-36 text-center">
            {MOIS_NOMS[mois - 1]} {annee}
          </span>
          <button
            onClick={() => naviguerMois(1)}
            className="p-1 rounded hover:bg-gray-100 transition-colors"
            disabled={mois === maxMois && annee === maxAnnee}
          >
            <ChevronRight className="w-4 h-4 text-gray-600 disabled:opacity-30" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setTab("performances")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "performances"
              ? "border-[#1E40AF] text-[#1E40AF]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Performances
        </button>
        <button
          onClick={handleTabPlanning}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === "planning"
              ? "border-[#1E40AF] text-[#1E40AF]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Planning
        </button>
      </div>

      {/* Planning tab */}
      {tab === "planning" && (
        <div className="space-y-4">
          {planningLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin text-[#1E40AF]" />
            </div>
          ) : planningData === null || planningData.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-sm text-gray-400">
              Aucun planning configuré pour ce commercial.
            </div>
          ) : (
            planningData.map((p) => (
              <div key={p.displayName} className="space-y-4">
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                {/* Header carte */}
                <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2 bg-gray-50">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
                    <span className="font-semibold">Territoire :</span>
                    {p.departements.map((d) => (
                      <span key={d} className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-mono">{d}</span>
                    ))}
                    {p.belgique && (
                      <span className="px-2 py-0.5 bg-violet-100 text-violet-700 text-xs rounded-full">Belgique</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">
                    <span className="font-semibold">Jours dispo :</span> {p.joursDispo}j / mois
                  </span>
                </div>

                {/* Tableau */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-5 py-3 font-semibold text-gray-600">Groupe</th>
                      <th className="text-center px-4 py-3 font-semibold text-gray-600">Nb clients</th>
                      <th className="text-right px-5 py-3 font-semibold text-gray-600">Jours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {([
                      { type: "A",            label: "A – Stratégiques",         nb: p.nbA,           jours: p.joursA,      color: "text-blue-700" },
                      { type: "B",            label: "B – Réguliers",            nb: p.nbB,           jours: p.joursB,      color: "text-green-700" },
                      { type: "nouveaux",     label: "C – Nouveaux",             nb: p.nbNouveaux,    jours: p.joursNouveaux, color: "text-violet-700" },
                      { type: "merchTV",      label: "Merch TV (strat. télévente)", nb: p.nbMerchTV,    jours: p.joursMTV,    color: "text-violet-700" },
                      { type: "merchIlyasse", label: "Merch Ilyasse",            nb: p.nbMerchIlyasse, jours: p.joursMI,   color: "text-amber-700" },
                    ] as const).map(({ type, label, nb, jours, color }) => (
                      <tr
                        key={type}
                        onClick={() => p.userId && nb > 0 && openPanel(p.userId, type, label)}
                        className={`transition-colors ${nb > 0 && p.userId ? "cursor-pointer hover:bg-blue-50" : "opacity-50"}`}
                      >
                        <td className="px-5 py-3 text-gray-800">{label}</td>
                        <td className="px-4 py-3 text-center font-medium text-gray-900">{nb}</td>
                        <td className={`px-5 py-3 text-right font-semibold ${color}`}>{jours}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                    <tr>
                      <td className="px-5 py-3 font-semibold text-gray-700">Total utilisé</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-900">
                        {p.nbA + p.nbB + p.nbNouveaux + p.nbMerchTV + p.nbMerchIlyasse}
                      </td>
                      <td className="px-5 py-3 text-right font-bold text-gray-900">
                        {p.totalJours} / {p.joursDispo}j
                      </td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-semibold text-gray-700">Jours libres</td>
                      <td className="px-4 py-3" />
                      <td className={`px-5 py-3 text-right font-bold text-lg ${
                        p.joursLibres > 5 ? "text-green-600" : p.joursLibres >= 0 ? "text-orange-500" : "text-red-600"
                      }`}>
                        {p.joursLibres}j
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Tableau clients du commercial */}
              {p.clients && p.clients.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-gray-700">
                      Portefeuille clients — {p.clients.length} client{p.clients.length > 1 ? "s" : ""}
                    </h4>
                    <span className="text-xs text-gray-400">
                      {p.clients.filter((c) => c.dansTerritory).length} dans le territoire
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Code</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Client</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">CP</th>
                          <th className="text-left px-4 py-2.5 font-semibold text-gray-600 text-xs">Catégorie</th>
                          <th className="text-center px-4 py-2.5 font-semibold text-gray-600 text-xs">Territoire</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {p.clients.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50">
                            <td className="px-4 py-2.5 font-mono text-xs text-gray-400">{c.codeClient}</td>
                            <td className="px-4 py-2.5 font-medium text-gray-900">{c.nom}</td>
                            <td className="px-4 py-2.5 text-gray-500 font-mono text-xs">{c.codePostal || "—"}</td>
                            <td className="px-4 py-2.5">
                              {c.categorieStatut ? (
                                <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${CATEGORY_COLORS[c.categorieStatut] ?? "bg-gray-100 text-gray-500"}`}>
                                  {c.categorieStatut}
                                </span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              {c.dansTerritory
                                ? <span className="text-green-600 text-xs font-medium">✓</span>
                                : <span className="text-gray-300 text-xs">✗</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
              </div>
            ))
          )}
        </div>
      )}

      {tab === "performances" && (<>
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KPICard
          title={`CA ${MOIS_NOMS[mois - 1]}`}
          value={formatCurrency(stats?.caMois || 0)}
          icon={Euro}
          trend={stats?.variation}
          color="blue"
          subtitle={`vs ${MOIS_NOMS[mois === 1 ? 11 : mois - 2]} : ${formatCurrency(stats?.caPrecedent || 0)}`}
        />
        <KPICard
          title="Clients actifs"
          value={stats?.clientsActifs || 0}
          icon={Users}
          color="green"
          subtitle={`Total portefeuille : ${stats?.totalClients || 0}`}
        />
        <KPICard
          title="Ont commandé"
          value={`${stats?.nbCommandesMois || 0} / ${stats?.totalClients || 0}`}
          icon={TrendingUp}
          color={tauxCommande >= 70 ? "green" : tauxCommande >= 40 ? "orange" : "red"}
          subtitle={`Taux : ${tauxCommande}% ce mois`}
        />
        <KPICard
          title="Sans commande"
          value={stats?.nbSansCommande || 0}
          icon={AlertCircle}
          color="red"
          subtitle="À relancer ce mois"
        />
      </div>

      {/* Barre progression */}
      {stats && stats.totalClients > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">Taux de commande du mois</span>
            <span className="font-bold text-gray-900">{tauxCommande}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${
                tauxCommande >= 70
                  ? "bg-green-500"
                  : tauxCommande >= 40
                  ? "bg-orange-400"
                  : "bg-red-500"
              }`}
              style={{ width: `${tauxCommande}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span className="text-green-600 font-medium">
              {stats.nbCommandesMois} ont commandé
            </span>
            <span className="text-red-500 font-medium">
              {stats.nbSansCommande} n'ont pas commandé
            </span>
          </div>
        </div>
      )}

      {/* Objectif du mois */}
      {objectif && objectif.montantCible > 0 && stats && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-[#1E40AF]" />
              <span className="text-sm font-semibold text-gray-800">
                Objectif {MOIS_NOMS[mois - 1]} {annee}
              </span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-[#1E40AF]">
                {formatCurrency(objectif.montantCible)}
              </span>
              {objectif.tauxCroissance !== null && (
                <div className="text-[10px] text-gray-400">
                  {objectif.tauxCroissance >= 0 ? "+" : ""}
                  {objectif.tauxCroissance.toFixed(1)}% vs mois préc.
                </div>
              )}
            </div>
          </div>
          {/* Barre de progression CA vs objectif */}
          {(() => {
            const pct = Math.min(Math.round((stats.caMois / objectif.montantCible) * 100), 100);
            const depasse = stats.caMois >= objectif.montantCible;
            const couleur = depasse ? "bg-green-500" : pct >= 70 ? "bg-blue-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400";
            return (
              <>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div
                    className={`h-3 rounded-full transition-all duration-500 ${couleur}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">
                    Réalisé : <strong className="text-gray-800">{formatCurrency(stats.caMois)}</strong>
                  </span>
                  <span className={`font-semibold ${depasse ? "text-green-600" : "text-gray-600"}`}>
                    {depasse ? `Objectif atteint (+${formatCurrency(stats.caMois - objectif.montantCible)})` : `${pct}% atteint — manque ${formatCurrency(objectif.montantCible - stats.caMois)}`}
                  </span>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* Graphique évolution — tous les mois */}
      {evolution && evolution.length > 0 ? (
        <RevenueChart
          data={evolution}
          title={`Évolution CA — ${user?.name || "commercial"} (tous les mois)`}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-5 text-center text-sm text-gray-400">
          Aucune donnée d'évolution disponible
        </div>
      )}

      {/* Table clients */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Clients — {MOIS_NOMS[mois - 1]} {annee}
            </h3>
            <div className="flex flex-wrap items-center gap-2">
              {(["tous", "commande", "pas_commande"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFiltre(f)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    filtre === f
                      ? "bg-[#1E40AF] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {f === "tous"
                    ? `Tous (${data?.clients?.length || 0})`
                    : f === "commande"
                    ? `✓ Commandé (${stats?.nbCommandesMois || 0})`
                    : `✗ Pas commandé (${stats?.nbSansCommande || 0})`}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-44 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <select
              value={filtreCat}
              onChange={(e) => setFiltreCat(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-600"
            >
              <option value="">Toutes catégories</option>
              {uniqueCategories.sort().map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={filtreSousCat}
              onChange={(e) => setFiltreSousCat(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-600"
            >
              <option value="">Toutes sous-catégories</option>
              {uniqueSousCategories.sort().map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filtreActif}
              onChange={(e) => setFiltreActif(e.target.value as "tous" | "actif" | "inactif")}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300 text-gray-600"
            >
              <option value="tous">Actif / Inactif</option>
              <option value="actif">Actif uniquement</option>
              <option value="inactif">Inactif uniquement</option>
            </select>
            {(filtreCat || filtreSousCat || filtreActif !== "tous" || search) && (
              <button
                onClick={() => { setSearch(""); setFiltreCat(""); setFiltreSousCat(""); setFiltreActif("tous"); }}
                className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 font-medium transition-colors"
              >
                Réinitialiser
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {([
                  { field: "codeClient", label: "Code",           cls: "text-left" },
                  { field: "nom",        label: "Client",         cls: "text-left" },
                  { field: "codePostal", label: "CP",             cls: "text-left" },
                  { field: "categorieStatut", label: "Catégorie", cls: "text-left whitespace-nowrap" },
                  { field: "sousCategorie",   label: "Sous-catégorie", cls: "text-left whitespace-nowrap" },
                  { field: "commande",   label: MOIS_NOMS[mois - 1], cls: "text-center" },
                  { field: "caMois",     label: "CA mois",        cls: "text-right" },
                  { field: "derniereCommande", label: "Dernière cmd", cls: "text-left whitespace-nowrap" },
                  { field: "totalCommandes",   label: "Total cmds",   cls: "text-right" },
                  { field: "actif",      label: "Actif",          cls: "text-center" },
                ] as const).map(({ field, label, cls }) => (
                  <th
                    key={field}
                    onClick={() => handleSort(field)}
                    className={`px-4 py-3 font-semibold text-gray-600 cursor-pointer hover:bg-gray-100 select-none ${cls}`}
                  >
                    {label}
                    {sortField === field
                      ? sortDir === "asc"
                        ? <ArrowUp className="w-3.5 h-3.5 inline ml-1 text-blue-600" />
                        : <ArrowDown className="w-3.5 h-3.5 inline ml-1 text-blue-600" />
                      : <ArrowUpDown className="w-3.5 h-3.5 inline ml-1 text-gray-300" />
                    }
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientsFiltres.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-400 text-sm">
                    Aucun client trouvé
                  </td>
                </tr>
              ) : (
                clientsFiltres.map((c) => (
                  <tr
                    key={c.id}
                    className={`hover:bg-gray-50 transition-colors ${
                      !c.aCommandeMois ? "bg-red-50/40" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {c.codeClient}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.nom}</td>
                    <td className="px-4 py-3 text-gray-500">{c.codePostal || "—"}</td>
                    <td className="px-4 py-3">
                      {c.categorieStatut ? (
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${statutStyle(c.categorieStatut)}`}>
                          {c.categorieStatut}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {c.sousCategorie ? (
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${sousCatStyle(c.sousCategorie)}`}>
                          {c.sousCategorie}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.aCommandeMois ? (
                        <span className="inline-flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Commandé
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-red-100 text-red-600 text-xs font-medium px-2 py-0.5 rounded-full">
                          <XCircle className="w-3 h-3" /> Pas commandé
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">
                      {c.aCommandeMois ? (
                        <span className="text-green-700">{formatCurrency(c.caMois)}</span>
                      ) : (
                        <span className="text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {c.derniereCommande ? (
                        format(new Date(c.derniereCommande), "dd MMM yyyy", { locale: fr })
                      ) : (
                        <span className="text-gray-300">Jamais</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {c.totalCommandes}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {c.actif ? (
                        <span
                          className="inline-block w-2 h-2 rounded-full bg-green-500"
                          title="Actif"
                        />
                      ) : (
                        <span
                          className="inline-block w-2 h-2 rounded-full bg-gray-300"
                          title="Inactif"
                        />
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {clientsFiltres.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-4 text-xs text-gray-500">
            <span>
              <strong className="text-gray-700">{clientsFiltres.length}</strong> clients affichés
            </span>
            <span>
              CA total affiché :{" "}
              <strong className="text-gray-700">
                {formatCurrency(clientsFiltres.reduce((s, c) => s + c.caMois, 0))}
              </strong>
            </span>
          </div>
        )}
      </div>
      </>)}

      {/* Panneau latéral — clients du groupe */}
      {panelOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div
            className="flex-1 bg-black/20 backdrop-blur-sm"
            onClick={() => setPanelOpen(false)}
          />
          <div className="w-88 bg-white shadow-2xl flex flex-col h-full border-l border-gray-200" style={{ width: "360px" }}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-gray-50">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm">{panelTitle}</h2>
                {!panelLoading && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {panelClients.length} client{panelClients.length > 1 ? "s" : ""}
                  </p>
                )}
              </div>
              <button
                onClick={() => setPanelOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Contenu */}
            <div className="flex-1 overflow-y-auto">
              {panelLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin text-[#1E40AF]" />
                </div>
              ) : panelClients.length === 0 ? (
                <p className="text-center text-gray-400 py-16 text-sm">Aucun client trouvé</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {panelClients.map((client) => (
                    <li key={client.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                      <p className="font-medium text-gray-900 text-sm">{client.nom}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Hash className="w-3 h-3 flex-shrink-0" />
                          {client.codeClient}
                        </span>
                        {client.codePostal && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <MapPin className="w-3 h-3 flex-shrink-0" />
                            {client.codePostal}
                          </span>
                        )}
                        {client.telephone && (
                          <span className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                            <Phone className="w-3 h-3 flex-shrink-0" />
                            {client.telephone}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
