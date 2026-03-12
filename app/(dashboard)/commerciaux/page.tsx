"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import KPICard from "@/components/dashboard/KPICard";
import {
  UsersRound,
  Euro,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ArrowRight,
  TrendingDown,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Search,
  X,
} from "lucide-react";

const MOIS_NOMS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = [
  "bg-blue-600",
  "bg-indigo-600",
  "bg-violet-600",
  "bg-emerald-600",
  "bg-orange-500",
  "bg-rose-600",
  "bg-teal-600",
  "bg-cyan-600",
];

function avatarColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatRole(role: string) {
  return role.replace(/_/g, " ");
}

function teamType(role: string): "terrain" | "televente" | "autre" {
  if (role.includes("TERRAIN")) return "terrain";
  if (role.includes("TELEVENTE")) return "televente";
  return "autre";
}

interface CommercialStats {
  user: { id: string; name: string; role: string; teamType: string | null };
  caMois: number;
  caPrecedent: number;
  variation: number;
  clientsActifs: number;
  totalClients: number;
  nbCommandesMois: number;
  taux: number;
}

interface ApiResponse {
  commerciaux: CommercialStats[];
  totaux: { nbCommerciaux: number; caTotal: number; tauxMoyen: number };
}

type Filtre = "tous" | "terrain" | "televente";
type SortField = "name" | "caMois" | "taux";

const SORT_LABELS: Record<SortField, string> = {
  name: "Nom",
  caMois: "CA du mois",
  taux: "Taux commande",
};

const CHEF_ROLES = ["CHEF_TERRAIN", "CHEF_TELEVENTE"];

export default function CommerciauxPage() {
  const { data: session } = useSession();
  const now = new Date();
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filtre, setFiltre] = useState<Filtre>("tous");
  const [sortBy, setSortBy] = useState<SortField>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [search, setSearch] = useState("");

  const isChef = session ? CHEF_ROLES.includes(session.user.role) : false;

  useEffect(() => {
    setLoading(true);
    fetch(`/api/commerciaux?mois=${mois}&annee=${annee}&sortBy=${sortBy}&sortOrder=${sortOrder}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [mois, annee, sortBy, sortOrder]);

  function naviguerMois(delta: number) {
    let m = mois + delta;
    let a = annee;
    if (m > 12) { m = 1; a++; }
    if (m < 1) { m = 12; a--; }
    setMois(m);
    setAnnee(a);
  }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(field);
      setSortOrder("asc");
    }
  }

  const commerciaux = (data?.commerciaux ?? []).filter((c) => {
    if (!isChef) {
      if (filtre !== "tous" && teamType(c.user.role) !== filtre) return false;
    }
    if (search && !c.user.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totaux = data?.totaux;

  function SortButton({ field }: { field: SortField }) {
    const active = sortBy === field;
    return (
      <button
        onClick={() => handleSort(field)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          active
            ? "bg-[#1E40AF] text-white"
            : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
        }`}
      >
        {SORT_LABELS[field]}
        {active ? (
          sortOrder === "asc" ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* En-tête */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Header title="Commerciaux" subtitle={isChef ? "Performances de votre équipe" : "Performances de l'équipe"} />
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
            disabled={mois === now.getMonth() + 1 && annee === now.getFullYear()}
          >
            <ChevronRight className="w-4 h-4 text-gray-600 disabled:opacity-30" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#1E40AF]" />
        </div>
      ) : (
        <>
          {/* KPIs globaux */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KPICard
              title="Commerciaux actifs"
              value={totaux?.nbCommerciaux ?? 0}
              icon={UsersRound}
              color="blue"
              subtitle="dans l'équipe"
            />
            <KPICard
              title={`CA équipe — ${MOIS_NOMS[mois - 1]}`}
              value={formatCurrency(totaux?.caTotal ?? 0)}
              icon={Euro}
              color="green"
            />
            <KPICard
              title="Taux de commande moyen"
              value={`${totaux?.tauxMoyen ?? 0}%`}
              icon={TrendingUp}
              color={
                (totaux?.tauxMoyen ?? 0) >= 70
                  ? "green"
                  : (totaux?.tauxMoyen ?? 0) >= 40
                  ? "orange"
                  : "red"
              }
              subtitle="clients ayant commandé ce mois"
            />
          </div>

          {/* Recherche + filtres équipe + tri */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {/* Barre de recherche par nom */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Rechercher un commercial..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
                {search && (
                  <button
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Filtres équipe (masqués pour les chefs) */}
              {!isChef && (
                <div className="flex items-center gap-2">
                  {(["tous", "terrain", "televente"] as Filtre[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => setFiltre(f)}
                      className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${
                        filtre === f
                          ? "bg-[#1E40AF] text-white"
                          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      {f === "tous" ? "Tous" : f === "terrain" ? "Terrain" : "Télévente"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tri */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Trier par :</span>
              {(["name", "caMois", "taux"] as SortField[]).map((f) => (
                <SortButton key={f} field={f} />
              ))}
            </div>
          </div>

          {/* Liste des commerciaux */}
          {commerciaux.length === 0 ? (
            <div className="text-center py-16 text-gray-400">Aucun commercial trouvé</div>
          ) : (
            <div className="space-y-3">
              {commerciaux.map((c) => {
                const taux = c.taux ?? (c.totalClients > 0 ? Math.round((c.nbCommandesMois / c.totalClients) * 100) : 0);
                const nbSansCommande = c.totalClients - c.nbCommandesMois;

                return (
                  <div
                    key={c.user.id}
                    className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex flex-wrap items-center gap-4">
                      {/* Avatar */}
                      <div
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${avatarColor(c.user.id)}`}
                      >
                        {getInitials(c.user.name)}
                      </div>

                      {/* Nom + rôle */}
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{c.user.name}</p>
                        <p className="text-xs text-gray-400">{formatRole(c.user.role)}</p>
                      </div>

                      {/* CA du mois */}
                      <div className="text-right min-w-[120px]">
                        <p className="text-sm text-gray-500">CA {MOIS_NOMS[mois - 1]}</p>
                        <p className="font-bold text-gray-900">{formatCurrency(c.caMois)}</p>
                        {c.caPrecedent > 0 && (
                          <span
                            className={`text-xs font-medium flex items-center justify-end gap-0.5 ${
                              c.variation >= 0 ? "text-green-600" : "text-red-500"
                            }`}
                          >
                            {c.variation >= 0 ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {c.variation >= 0 ? "+" : ""}
                            {c.variation}%
                          </span>
                        )}
                      </div>

                      {/* Clients + barre */}
                      <div className="min-w-[180px]">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>
                            <span className="font-semibold text-gray-800">{c.nbCommandesMois}</span>
                            {" / "}
                            <span className="font-semibold text-gray-800">{c.totalClients}</span>
                            {" clients ont commandé"}
                          </span>
                          <span className="font-semibold text-gray-700">{taux}%</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              taux >= 70
                                ? "bg-green-500"
                                : taux >= 40
                                ? "bg-orange-400"
                                : "bg-red-500"
                            }`}
                            style={{ width: `${taux}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs mt-0.5">
                          <span className="text-green-600">{c.nbCommandesMois} commandé</span>
                          <span className="text-red-500">{nbSansCommande} à relancer</span>
                        </div>
                      </div>

                      {/* Bouton détails */}
                      <Link
                        href={`/commercial/${c.user.id}`}
                        className="flex items-center gap-1 text-sm font-medium text-[#1E40AF] hover:underline flex-shrink-0"
                      >
                        Voir détails
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
