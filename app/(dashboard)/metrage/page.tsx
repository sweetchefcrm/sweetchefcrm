"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Ruler, Loader2, Users, TrendingUp, LayoutGrid } from "lucide-react";
import Header from "@/components/layout/Header";
import MetrageTable from "@/components/metrage/MetrageTable";
import ScatterPlot from "@/components/metrage/ScatterPlot";
import { Role } from "@prisma/client";
import { PERMISSIONS, canAccess } from "@/lib/permissions";

type ClientMetrage = {
  id: string;
  nom: string;
  codeClient: string;
  lineaire: number | null;
  commercial: { id: string; name: string };
  caAnnuel: number;
  caParMois: { mois: number; annee: number; total: number }[];
  caMetre: number | null;
};

type Stats = {
  totalAvecLineaire: number;
  totalClients: number;
  caMoyenParMetre: number;
  totalLineaire: number;
};

type CommercialOption = { id: string; name: string };

export default function MetragePage() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;

  const [clients, setClients] = useState<ClientMetrage[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [commerciaux, setCommerciaux] = useState<CommercialOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [commercialFilter, setCommercialFilter] = useState("");
  const [onlyWithLineaire, setOnlyWithLineaire] = useState(false);

  const canEdit = role ? canAccess(role, PERMISSIONS.EDIT_DATA) : false;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (commercialFilter) params.set("commercial", commercialFilter);
      if (onlyWithLineaire) params.set("onlyWithLineaire", "true");

      const res = await fetch(`/api/metrage?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setClients(data.clients);
      setStats(data.stats);

      // Extraire la liste unique des commerciaux
      const commMap: Record<string, string> = {};
      for (const c of data.clients as ClientMetrage[]) {
        commMap[c.commercial.id] = c.commercial.name;
      }
      setCommerciaux(Object.entries(commMap).map(([id, name]) => ({ id, name })));
    } finally {
      setLoading(false);
    }
  }, [search, commercialFilter, onlyWithLineaire]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleMetrageUpdate(id: string, lineaire: number | null) {
    const res = await fetch(`/api/metrage/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lineaire }),
    });
    if (res.ok) {
      // Update local state
      setClients((prev) =>
        prev.map((c) => {
          if (c.id !== id) return c;
          const newCaMetre =
            lineaire !== null && lineaire > 0 && c.caAnnuel > 0
              ? Math.round(c.caAnnuel / lineaire)
              : null;
          return { ...c, lineaire, caMetre: newCaMetre };
        })
      );
      // Refresh stats
      fetchData();
    }
  }

  return (
    <div className="flex flex-col h-full">
      <Header title="Métrage Linéaire" subtitle="Espace physique et rentabilité par mètre" />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Clients avec métrage</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalAvecLineaire}
                  <span className="text-sm font-normal text-gray-400 ml-1">/ {stats.totalClients}</span>
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Ruler className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Métrage total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalLineaire.toLocaleString("fr-FR")} m
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">CA/m moyen</p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalAvecLineaire > 0
                    ? stats.caMoyenParMetre.toLocaleString("fr-FR", {
                        style: "currency",
                        currency: "EUR",
                        maximumFractionDigits: 0,
                      })
                    : "–"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un client..."
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <select
            value={commercialFilter}
            onChange={(e) => setCommercialFilter(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Tous les commerciaux</option>
            {commerciaux
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyWithLineaire}
              onChange={(e) => setOnlyWithLineaire(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            Seulement avec métrage
          </label>

          {loading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin ml-auto" />}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <MetrageTable
            clients={clients}
            canEdit={canEdit}
            onMetrageUpdate={handleMetrageUpdate}
          />
        )}

        {/* Scatter Chart */}
        {!loading && clients.some((c) => c.lineaire !== null) && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <LayoutGrid className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-semibold text-gray-800">Corrélation Métrage ↔ CA Annuel</h2>
            </div>
            <ScatterPlot clients={clients} />
          </div>
        )}
      </div>

    </div>
  );
}
