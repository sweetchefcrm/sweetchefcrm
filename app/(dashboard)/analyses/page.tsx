"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import TopClientsChart from "@/components/analyses/TopClientsChart";
import PanierMoyenChart from "@/components/analyses/PanierMoyenChart";
import EvolutionPanierChart from "@/components/analyses/EvolutionPanierChart";
import CategorieStatutChart from "@/components/admin/analytics/CategorieStatutChart";
import CategorieTypeChart from "@/components/admin/analytics/CategorieTypeChart";
import CommercialsAnalyticsChart from "@/components/admin/analytics/CommercialsAnalyticsChart";
import EvolutionMensuelleChart from "@/components/admin/analytics/EvolutionMensuelleChart";
import {
  TrendingUp,
  TrendingDown,
  Euro,
  ShoppingCart,
  Users,
  BarChart2,
  Loader2,
  Calendar,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const MOIS_LABELS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];

function formatCurrency(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

interface PeriodOption {
  mois: number;
  annee: number;
}

interface AnalysesData {
  selectedPeriod: PeriodOption;
  caComparaison: { moisCourant: number; moisPrecedent: number; variation: number };
  top10Clients: Array<{ id: string; nom: string; ca: number }>;
  panierMoyen: { global: number; nbVentes: number };
  caParCommercial: Array<{ id: string; name: string; teamType: string | null; ca: number }>;
  panierMoyenParCommercial: Array<{
    id: string; name: string; teamType: string | null; panierMoyen: number; nbVentes: number;
  }>;
  caParEquipe: Array<{ equipe: string; ca: number; color: string }>;
  evolutionPanierMoyen: Array<{ label: string; panierMoyen: number; nbVentes: number }>;
  moisDisponibles: PeriodOption[];
}

interface EvolutionEntry {
  label: string;
  mois: number;
  annee: number;
  ca: number;
  diff: number | null;
  diffPct: number | null;
}

interface AnalyticsData {
  caParStatut: { statut: string; ca: number }[];
  caParType: { type: string; ca: number }[];
  evolutionMensuelle: EvolutionEntry[];
  caParCommercial: { label: string; ca: number; commercialId?: string; teamType?: string | null }[];
  commerciauxList: { id: string; name: string; role: string; teamType: string | null }[];
}

export default function AnalysesPage() {
  const now = new Date();

  // ── État section analyses (existante) ─────────────────────────────────────
  const [selectedMois,  setSelectedMois]  = useState(now.getMonth() + 1);
  const [selectedAnnee, setSelectedAnnee] = useState(now.getFullYear());
  const [data,    setData]    = useState<AnalysesData | null>(null);
  const [loading, setLoading] = useState(true);

  // ── État section analytics avancée ────────────────────────────────────────
  const [analyticsData,         setAnalyticsData]         = useState<AnalyticsData | null>(null);
  const [analyticsLoading,      setAnalyticsLoading]      = useState(true);
  const [analyticsPeriod,       setAnalyticsPeriod]       = useState<"daily" | "monthly">("monthly");
  const [analyticsCommercialId, setAnalyticsCommercialId] = useState("all");
  const [analyticsTeamType,     setAnalyticsTeamType]     = useState("all");
  const [analyticsMonth,        setAnalyticsMonth]        = useState("all");

  // ── Fetch analyses ─────────────────────────────────────────────────────────
  const fetchData = useCallback((mois: number, annee: number) => {
    setLoading(true);
    fetch(`/api/analyses?mois=${mois}&annee=${annee}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  // ── Fetch analytics ────────────────────────────────────────────────────────
  const fetchAnalytics = useCallback(
    (
      period: "daily" | "monthly",
      commercialId: string,
      teamType: string,
      month = "all"
    ) => {
      setAnalyticsLoading(true);
      const params = new URLSearchParams({ period, commercialId, teamType, month });
      fetch(`/api/admin/analytics?${params}`)
        .then((r) => r.json())
        .then(setAnalyticsData)
        .finally(() => setAnalyticsLoading(false));
    },
    []
  );

  useEffect(() => { fetchData(selectedMois, selectedAnnee); }, [selectedMois, selectedAnnee, fetchData]);
  useEffect(() => { fetchAnalytics(analyticsPeriod, analyticsCommercialId, analyticsTeamType); }, []);

  // ── Handlers analytics ─────────────────────────────────────────────────────
  function handlePeriodChange(p: "daily" | "monthly") {
    setAnalyticsPeriod(p);
    fetchAnalytics(p, analyticsCommercialId, analyticsTeamType);
  }
  function handleCommercialChange(id: string) {
    setAnalyticsCommercialId(id);
    fetchAnalytics(analyticsPeriod, id, analyticsTeamType);
  }
  function handleTeamTypeChange(t: string) {
    setAnalyticsTeamType(t);
    setAnalyticsCommercialId("all");
    setAnalyticsMonth("all");
    fetchAnalytics(analyticsPeriod, "all", t, "all");
  }
  function handleMonthChange(m: string) {
    setAnalyticsMonth(m);
    fetchAnalytics(analyticsPeriod, analyticsCommercialId, analyticsTeamType, m);
  }

  // ── Options de période ─────────────────────────────────────────────────────
  const fallbackOptions: PeriodOption[] = [];
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    fallbackOptions.push({ mois: d.getMonth() + 1, annee: d.getFullYear() });
  }
  const periodOptions: PeriodOption[] =
    data?.moisDisponibles && data.moisDisponibles.length > 0
      ? data.moisDisponibles
      : fallbackOptions;

  const currentIdx = periodOptions.findIndex(
    (p) => p.mois === selectedMois && p.annee === selectedAnnee
  );
  const hasPrev = currentIdx < periodOptions.length - 1;
  const hasNext = currentIdx > 0;

  const goToPrev = () => {
    if (!hasPrev) return;
    const p = periodOptions[currentIdx + 1];
    setSelectedMois(p.mois); setSelectedAnnee(p.annee);
  };
  const goToNext = () => {
    if (!hasNext) return;
    const p = periodOptions[currentIdx - 1];
    setSelectedMois(p.mois); setSelectedAnnee(p.annee);
  };

  const isCurrentMonth =
    selectedMois === now.getMonth() + 1 && selectedAnnee === now.getFullYear();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#1E40AF]" />
      </div>
    );
  }

  const comparaison             = data?.caComparaison;
  const top10                   = data?.top10Clients || [];
  const panier                  = data?.panierMoyen;
  const caParCommercial         = data?.caParCommercial || [];
  const panierMoyenParCommercial = data?.panierMoyenParCommercial || [];
  const caParEquipe             = data?.caParEquipe || [];
  const evolutionPanier         = data?.evolutionPanierMoyen || [];
  const isPositive              = (comparaison?.variation || 0) >= 0;
  const totalCA                 = caParCommercial.reduce((s, c) => s + c.ca, 0);

  const prevMoisNum  = selectedMois === 1 ? 12 : selectedMois - 1;
  const prevAnneeNum = selectedMois === 1 ? selectedAnnee - 1 : selectedAnnee;
  const prevLabel    = `${MOIS_LABELS[prevMoisNum - 1]} ${prevAnneeNum}`;

  return (
    <div className="p-6 space-y-6">
      <Header title="Analyses" subtitle="Performances et tendances" />

      {/* ── Sélecteur de période ─────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 text-gray-600">
          <Calendar className="w-4 h-4" />
          <span className="text-sm font-medium">Période analysée :</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            disabled={!hasPrev}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <select
            value={selectedMois}
            onChange={(e) => setSelectedMois(parseInt(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>{MOIS_LABELS[m - 1]}</option>
            ))}
          </select>
          <select
            value={selectedAnnee}
            onChange={(e) => setSelectedAnnee(parseInt(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Array.from(
              new Set([
                ...periodOptions.map((p) => p.annee),
                now.getFullYear(),
                now.getFullYear() - 1,
              ])
            )
              .sort((a, b) => b - a)
              .map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          <button
            onClick={goToNext}
            disabled={!hasNext}
            className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {isCurrentMonth ? (
          <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2.5 py-1 rounded-full">
            Mois courant
          </span>
        ) : (
          <button
            onClick={() => { setSelectedMois(now.getMonth() + 1); setSelectedAnnee(now.getFullYear()); }}
            className="text-xs text-blue-600 underline hover:text-blue-800 transition"
          >
            Revenir au mois courant
          </button>
        )}
      </div>

      {/* ── Comparaison M vs M-1 ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">
            CA — {MOIS_LABELS[selectedMois - 1]} {selectedAnnee}
          </p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(comparaison?.moisCourant || 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm text-gray-500 mb-1">CA — {prevLabel}</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatCurrency(comparaison?.moisPrecedent || 0)}
          </p>
        </div>
        <div className={`rounded-xl border p-5 ${isPositive ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
          <p className="text-sm text-gray-500 mb-1">Variation M vs M-1</p>
          <div className={`flex items-center gap-2 text-2xl font-bold ${isPositive ? "text-green-700" : "text-red-700"}`}>
            {isPositive ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
            {isPositive ? "+" : ""}
            {comparaison?.variation || 0}%
          </div>
        </div>
      </div>

      {/* ── KPIs panier ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="p-3 bg-blue-50 rounded-lg">
            <ShoppingCart className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Panier moyen ({selectedAnnee})</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(panier?.global || 0)}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="p-3 bg-green-50 rounded-lg">
            <Euro className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">Nb ventes ({selectedAnnee})</p>
            <p className="text-xl font-bold text-gray-900">{panier?.nbVentes || 0}</p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
          <div className="p-3 bg-violet-50 rounded-lg">
            <Users className="w-6 h-6 text-violet-600" />
          </div>
          <div>
            <p className="text-sm text-gray-500">CA total — {MOIS_LABELS[selectedMois - 1]} {selectedAnnee}</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalCA)}</p>
          </div>
        </div>
      </div>

      {/* ── Top 10 clients + CA par équipe ───────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {top10.length > 0 ? (
          <TopClientsChart data={top10} />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-center text-gray-400 text-sm h-40">
            Aucune vente sur cette période
          </div>
        )}
        {caParEquipe.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-gray-500" />
              CA par équipe — {MOIS_LABELS[selectedMois - 1]} {selectedAnnee}
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={caParEquipe} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="equipe" tick={{ fontSize: 12 }} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`} />
                <Tooltip formatter={(v) => [formatCurrency(Number(v)), "CA"]} />
                <Bar dataKey="ca" radius={[6, 6, 0, 0]} name="CA">
                  {caParEquipe.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── CA par commercial ────────────────────────────────────────────── */}
      {caParCommercial.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            CA par commercial — {MOIS_LABELS[selectedMois - 1]} {selectedAnnee}
          </h3>
          <div className="space-y-3">
            {caParCommercial.map((c) => {
              const max = Math.max(...caParCommercial.map((x) => x.ca));
              const pct = max > 0 ? (c.ca / max) * 100 : 0;
              const barColor =
                c.teamType === "TERRAIN" ? "bg-emerald-500"
                : c.teamType === "TELEVENTE" ? "bg-violet-500"
                : "bg-blue-500";
              return (
                <div key={c.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-gray-700 flex items-center gap-2">
                      {c.name}
                      {c.teamType && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                          c.teamType === "TERRAIN"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-violet-100 text-violet-700"
                        }`}>
                          {c.teamType === "TERRAIN" ? "Terrain" : "Télévente"}
                        </span>
                      )}
                    </span>
                    <span className="text-gray-500">{formatCurrency(c.ca)}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Panier moyen par commercial + évolution ──────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {panierMoyenParCommercial.length > 0 && <PanierMoyenChart data={panierMoyenParCommercial} />}
        {evolutionPanier.length > 0 && <EvolutionPanierChart data={evolutionPanier} />}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ── Analyses avancées ────────────────────────────────────────────── */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-3 pt-2">
        <div className="flex-1 h-px bg-gray-200" />
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
          <BarChart2 className="w-3.5 h-3.5" /> Analyses avancées
        </span>
        <div className="flex-1 h-px bg-gray-200" />
      </div>

      {analyticsLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-[#1E40AF]" />
        </div>
      ) : analyticsData ? (
        <div className="space-y-6">
          {/* Évolution mensuelle CA — pleine largeur */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">
                Évolution du CA mensuel
                <span className="ml-2 text-xs font-normal text-gray-400">
                  ({analyticsData.evolutionMensuelle.length} mois)
                </span>
              </h3>
              {analyticsTeamType !== "all" && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  analyticsTeamType === "TERRAIN"
                    ? "bg-blue-50 text-blue-700"
                    : "bg-emerald-50 text-emerald-700"
                }`}>
                  {analyticsTeamType}
                </span>
              )}
            </div>
            <EvolutionMensuelleChart data={analyticsData.evolutionMensuelle} />
          </div>

          {/* CA par statut + CA par type — côte à côte */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">CA par statut client</h3>
              <CategorieStatutChart data={analyticsData.caParStatut} />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">CA par type de client</h3>
              <CategorieTypeChart data={analyticsData.caParType} />
            </div>
          </div>

          {/* Classement / évolution par commercial — pleine largeur */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">CA par commercial</h3>
            <CommercialsAnalyticsChart
              data={analyticsData.caParCommercial}
              commerciauxList={analyticsData.commerciauxList}
              evolutionMonths={analyticsData.evolutionMensuelle}
              period={analyticsPeriod}
              commercialId={analyticsCommercialId}
              teamType={analyticsTeamType}
              selectedMonth={analyticsMonth}
              onPeriodChange={handlePeriodChange}
              onCommercialChange={handleCommercialChange}
              onTeamTypeChange={handleTeamTypeChange}
              onMonthChange={handleMonthChange}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
