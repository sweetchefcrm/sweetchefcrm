"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import KPICard from "@/components/dashboard/KPICard";
import RevenueChart from "@/components/dashboard/RevenueChart";
import DailyChart from "@/components/dashboard/DailyChart";
import CommercialsBarChart from "@/components/dashboard/CommercialsBarChart";
import { Euro, Users, UserPlus, Target, TrendingUp, Loader2 } from "lucide-react";

interface DashboardData {
  caMois: number;
  caAnnuel: number;
  clientsActifs: number;
  newClientsMonth: number;
  prospectsCount: number;
  evolutionPct: number;
  evolutionMensuelle: { mois: number; annee: number; ca: number }[];
  evolutionJournaliere: { jour: number; ca: number }[];
  caParCommercial: { id: string; name: string; teamType: string | null; ca: number }[];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const monthName = now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  const moisLabel = monthName.charAt(0).toUpperCase() + monthName.slice(1);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#1E40AF]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <Header
        title="Dashboard Global"
        subtitle={`Vue d'ensemble — ${moisLabel}`}
      />

      {/* KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        <KPICard
          title="CA du mois"
          value={formatCurrency(data?.caMois || 0)}
          icon={Euro}
          trend={data?.evolutionPct}
          color="blue"
        />
        <KPICard
          title="CA annuel"
          value={formatCurrency(data?.caAnnuel || 0)}
          icon={TrendingUp}
          color="green"
          subtitle={`Année ${now.getFullYear()}`}
        />
        <KPICard
          title="Clients actifs"
          value={data?.clientsActifs || 0}
          icon={Users}
          color="purple"
          subtitle="Commande ≤ 60 jours"
        />
        <KPICard
          title="Nouveaux clients"
          value={data?.newClientsMonth || 0}
          icon={UserPlus}
          color="orange"
          subtitle="Ce mois"
        />
        <KPICard
          title="Prospects actifs"
          value={data?.prospectsCount || 0}
          icon={Target}
          color="red"
          subtitle="Non convertis"
        />
      </div>

      {/* Graphiques — ligne 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Évolution mensuelle */}
        {data?.evolutionMensuelle && data.evolutionMensuelle.length > 0 && (
          <RevenueChart data={data.evolutionMensuelle} />
        )}

        {/* Évolution journalière */}
        <DailyChart data={data?.evolutionJournaliere || []} moisLabel={moisLabel} />
      </div>

      {/* CA par commercial */}
      {data?.caParCommercial && data.caParCommercial.length > 0 && (
        <CommercialsBarChart data={data.caParCommercial} />
      )}
    </div>
  );
}
