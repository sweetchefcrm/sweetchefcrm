"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Grid3x3, Loader2, Users, TrendingUp } from "lucide-react";
import Header from "@/components/layout/Header";
import FacingTable, { ClientFacing } from "@/components/facing/FacingTable";
import { Role } from "@prisma/client";

// Tous les rôles actifs peuvent saisir un facing
const EDIT_ROLES: string[] = [
  Role.ADMIN,
  Role.COMMERCIAL_PRINCIPAL,
  Role.CHEF_TERRAIN,
  Role.CHEF_TELEVENTE,
  Role.COMMERCIAL_TERRAIN,
  Role.COMMERCIAL_TELEVENTE,
  Role.COMMERCIAL_GRAND_COMPTE,
  Role.MERCHANDISEUR,
  Role.AUTRES,
];

// Seuls admin/chefs peuvent modifier les entrées existantes
const EDIT_ALL_ROLES: string[] = [
  Role.ADMIN,
  Role.CHEF_TERRAIN,
  Role.CHEF_TELEVENTE,
];

type Stats = {
  totalAvecFacing: number;
  totalClients: number;
  totalFacings: number;
  avgFacings: number;
  avgCAParFacing: number;
};

type CommercialOption = { id: string; name: string };

function getCurrentMois() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export default function FacingPage() {
  const { data: session } = useSession();
  const role = session?.user?.role as Role | undefined;

  const [clients, setClients] = useState<ClientFacing[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [commerciaux, setCommerciaux] = useState<CommercialOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [commercialFilter, setCommercialFilter] = useState("");
  const [moisFilter, setMoisFilter] = useState(getCurrentMois());
  const [categorieStatut, setCategorieStatut] = useState("");
  const [onlyWithFacing, setOnlyWithFacing] = useState(false);

  const canEdit = role ? EDIT_ROLES.includes(role) : false;
  const canEditAll = role ? EDIT_ALL_ROLES.includes(role) : false;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (commercialFilter) params.set("commercial", commercialFilter);
      if (moisFilter) params.set("mois", moisFilter);
      if (categorieStatut) params.set("categorieStatut", categorieStatut);
      if (onlyWithFacing) params.set("onlyWithFacing", "true");

      const res = await fetch(`/api/facing?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      setClients(data.clients);
      setStats(data.stats);
      if (data.commerciaux?.length > 0) setCommerciaux(data.commerciaux);
    } finally {
      setLoading(false);
    }
  }, [search, commercialFilter, moisFilter, categorieStatut, onlyWithFacing]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const isCommercialPur = role
    ? [
        Role.COMMERCIAL_TERRAIN,
        Role.COMMERCIAL_TELEVENTE,
        Role.COMMERCIAL_GRAND_COMPTE,
        Role.MERCHANDISEUR,
        Role.AUTRES,
      ].includes(role)
    : false;

  return (
    <div className="flex flex-col h-full">
      <Header
        title="Facing"
        subtitle="Nombre de facings par client · CA mensuel · Évolution"
      />

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* KPI Cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Clients avec facing
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.totalAvecFacing}
                  <span className="text-sm font-normal text-gray-400 ml-1">
                    / {stats.totalClients}
                  </span>
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
                <Grid3x3 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  Moy. facings / client
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.avgFacings > 0 ? stats.avgFacings : "–"}
                </p>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  CA moy. / facing
                </p>
                <p className="text-2xl font-bold text-gray-900">
                  {stats.avgCAParFacing > 0
                    ? stats.avgCAParFacing.toLocaleString("fr-FR", {
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
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm w-52 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          <input
            type="month"
            value={moisFilter}
            onChange={(e) => setMoisFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {!isCommercialPur && (
            <select
              value={commercialFilter}
              onChange={(e) => setCommercialFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="">Tous les commerciaux</option>
              {[...commerciaux]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          )}

          <select
            value={categorieStatut}
            onChange={(e) => setCategorieStatut(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Tous les statuts</option>
            <option value="strategique">Stratégiques</option>
            <option value="regulier">Réguliers</option>
            <option value="occasionnel">Occasionnels</option>
            <option value="nouveau">Nouveaux</option>
            <option value="perdu">Perdus</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={onlyWithFacing}
              onChange={(e) => setOnlyWithFacing(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-blue-600"
            />
            Avec facing uniquement
          </label>

          {loading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin ml-auto" />}
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <FacingTable
            clients={clients}
            canEdit={canEdit}
            canEditAll={canEditAll}
            selectedMois={moisFilter}
            onRefresh={fetchData}
          />
        )}
      </div>
    </div>
  );
}
