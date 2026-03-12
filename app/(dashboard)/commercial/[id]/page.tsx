"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

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

interface ClientRow {
  id: string;
  codeClient: string;
  nom: string;
  codePostal?: string;
  actif: boolean;
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
  const [data, setData] = useState<CommercialData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<"tous" | "commande" | "pas_commande">("tous");

  useEffect(() => {
    setLoading(true);
    fetch(`/api/commercial/${id}?mois=${mois}&annee=${annee}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [id, mois, annee]);

  function naviguerMois(delta: number) {
    let m = mois + delta;
    let a = annee;
    if (m > 12) { m = 1; a++; }
    if (m < 1) { m = 12; a--; }
    setMois(m);
    setAnnee(a);
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

  const clientsFiltres = (data?.clients || []).filter((c) => {
    if (
      search &&
      !c.nom.toLowerCase().includes(search.toLowerCase()) &&
      !c.codeClient.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    if (filtre === "commande" && !c.aCommandeMois) return false;
    if (filtre === "pas_commande" && c.aCommandeMois) return false;
    return true;
  });

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
            disabled={mois === now.getMonth() + 1 && annee === now.getFullYear()}
          >
            <ChevronRight className="w-4 h-4 text-gray-600 disabled:opacity-30" />
          </button>
        </div>
      </div>

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
        <div className="px-5 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-700">
            Clients — {MOIS_NOMS[mois - 1]} {annee}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              placeholder="Rechercher un client..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
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

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">CP</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">
                  {MOIS_NOMS[mois - 1]}
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">CA mois</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">
                  Dernière cmd
                </th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">
                  Total cmds
                </th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Actif</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clientsFiltres.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400 text-sm">
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
    </div>
  );
}
