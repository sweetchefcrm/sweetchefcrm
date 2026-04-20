"use client";

import { useState, useEffect, useRef } from "react";
import { Loader2, X, ChevronDown, ChevronRight, Check } from "lucide-react";
import Header from "@/components/layout/Header";
import SegmentationTable from "@/components/segmentation/SegmentationTable";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

const MOIS_NOMS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const CAT_CHART_COLORS: Record<string, string> = {
  stratégique: "#3B82F6",
  stratégiques: "#3B82F6",
  régulier: "#22C55E",
  réguliers: "#22C55E",
  occasionnel: "#F59E0B",
  occasionnels: "#F59E0B",
  nouveau: "#8B5CF6",
  nouveaux: "#8B5CF6",
  perdu: "#EF4444",
  perdus: "#EF4444",
  prospect: "#9CA3AF",
};

const BADGE_COLORS: Record<string, string> = {
  stratégiques: "bg-blue-100 text-blue-800",
  stratégique: "bg-blue-100 text-blue-800",
  réguliers: "bg-green-100 text-green-800",
  régulier: "bg-green-100 text-green-800",
  occasionnels: "bg-amber-100 text-amber-800",
  occasionnel: "bg-amber-100 text-amber-800",
  nouveaux: "bg-violet-100 text-violet-800",
  nouveau: "bg-violet-100 text-violet-800",
  perdus: "bg-red-100 text-red-800",
  perdu: "bg-red-100 text-red-800",
  prospect: "bg-gray-100 text-gray-500",
};

const CAT_PIVOT_COLORS: Record<string, string> = {
  stratégiques: "text-blue-700",
  stratégique: "text-blue-700",
  réguliers: "text-green-700",
  régulier: "text-green-700",
  occasionnels: "text-amber-700",
  occasionnel: "text-amber-700",
  nouveaux: "text-violet-700",
  nouveau: "text-violet-700",
  perdus: "text-red-600",
  perdu: "text-red-600",
  prospect: "text-gray-400",
};

const COMPARISON_COLORS = ["#1E40AF", "#7C3AED", "#DC2626", "#D97706", "#059669"];

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

interface SegItem { label: string; ca: number; nb: number; pct: number; }
interface CommercialItem extends SegItem { id: string; name: string; teamType: string | null; }
interface MoisRow {
  mois: number; annee: number; label: string; total: number; nb: number;
  parCategorie: Record<string, number>;
  parSousCategorie: Record<string, number>;
  parType: Record<string, number>;
}
interface PeriodeRow {
  key: string; label: string; total: number; nb: number;
  parCategorie: Record<string, number>;
  parSousCategorie: Record<string, number>;
  parType: Record<string, number>;
}
interface SegData {
  parCategorie: SegItem[];
  parSousCategorie: SegItem[];
  parType: SegItem[];
  parCommercial: CommercialItem[];
  parMois: MoisRow[];
  parPeriode: PeriodeRow[];
  totalCA: number;
  commerciauxList: { id: string; name: string; teamType: string | null }[];
  moisDisponibles: { mois: number; annee: number }[];
}

function PivotTable({
  title,
  description,
  rows,
  colKey,
  colorFn,
}: {
  title: string;
  description?: string;
  rows: PeriodeRow[];
  colKey: "parCategorie" | "parSousCategorie" | "parType";
  colorFn?: (key: string) => string;
}) {
  const colTotals: Record<string, number> = {};
  for (const row of rows) {
    for (const [k, v] of Object.entries(row[colKey])) {
      colTotals[k] = (colTotals[k] ?? 0) + v;
    }
  }
  const cols = Object.keys(colTotals).sort((a, b) => colTotals[b] - colTotals[a]);
  if (!rows.length || !cols.length) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{description ?? "Une ligne par période · colonnes = segments"}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Période</th>
              {cols.map((col) => (
                <th
                  key={col}
                  className={`text-right px-4 py-3 font-semibold whitespace-nowrap ${colorFn ? colorFn(col.toLowerCase()) : ""}`}
                >
                  {col}
                </th>
              ))}
              <th className="text-right px-5 py-3 font-bold whitespace-nowrap border-l border-gray-200">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={row.key} className="hover:bg-blue-50/40">
                <td className="px-5 py-2.5 font-semibold text-gray-800 whitespace-nowrap">{row.label}</td>
                {cols.map((col) => {
                  const val = row[colKey][col] ?? 0;
                  return (
                    <td key={col} className="px-4 py-2.5 text-right whitespace-nowrap">
                      {val > 0 ? (
                        <span className={`font-medium ${colorFn ? colorFn(col.toLowerCase()) : "text-gray-700"}`}>
                          {fmt(val)}
                        </span>
                      ) : (
                        <span className="text-gray-200">—</span>
                      )}
                    </td>
                  );
                })}
                <td className="px-5 py-2.5 text-right font-bold text-gray-900 whitespace-nowrap border-l border-gray-200">
                  {fmt(row.total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 bg-gray-50">
            <tr>
              <td className="px-5 py-3 font-bold text-gray-700 text-xs uppercase">Total</td>
              {cols.map((col) => (
                <td key={col} className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                  {fmt(colTotals[col])}
                </td>
              ))}
              <td className="px-5 py-3 text-right font-bold text-gray-900 border-l border-gray-200">
                {fmt(rows.reduce((s, r) => s + r.total, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function SegmentationPage() {
  const [globalData, setGlobalData] = useState<SegData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mois, setMois] = useState<number | null>(null);
  const [annee, setAnnee] = useState<number | null>(null);
  const [teamType, setTeamType] = useState("all");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [singleData, setSingleData] = useState<SegData | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [comparisonData, setComparisonData] = useState<Record<string, SegData>>({});
  const [compLoading, setCompLoading] = useState(false);
  const [vendorsOpen, setVendorsOpen] = useState(false);
  const vendorsRef = useRef<HTMLDivElement>(null);
  const [expandedMois, setExpandedMois] = useState<string | null>(null);
  const [granularite, setGranularite] = useState<"mois" | "semaine" | "jour">("mois");
  const [selectedWeek, setSelectedWeek] = useState("");
  const [selectedDay, setSelectedDay] = useState("");

  function moisToPeriode(rows: MoisRow[]): PeriodeRow[] {
    return rows.map((r) => ({
      key: `${r.annee}-${String(r.mois).padStart(2, "0")}`,
      label: r.label,
      total: r.total,
      nb: r.nb,
      parCategorie: r.parCategorie,
      parSousCategorie: r.parSousCategorie,
      parType: r.parType,
    }));
  }

  function getComparePeriodes(id: string): PeriodeRow[] {
    const d = comparisonData[id];
    if (!d) return [];
    if (granularite !== "mois" && d.parPeriode?.length > 0) return d.parPeriode;
    return moisToPeriode(d.parMois);
  }

  useEffect(() => {
    if (!vendorsOpen) return;
    function handleClick(e: MouseEvent) {
      if (vendorsRef.current && !vendorsRef.current.contains(e.target as Node)) {
        setVendorsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [vendorsOpen]);

  useEffect(() => {
    loadGlobal();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mois, annee, teamType, granularite, selectedWeek, selectedDay]);

  async function loadGlobal() {
    setLoading(true);
    const params = new URLSearchParams();
    if (granularite === "mois") {
      if (mois && annee) { params.set("mois", String(mois)); params.set("annee", String(annee)); }
    } else if (granularite === "semaine" && selectedWeek) {
      params.set("granularite", "semaine");
      params.set("semaine", selectedWeek);
    } else if (granularite === "jour" && selectedDay) {
      params.set("granularite", "jour");
      params.set("jour", selectedDay);
    }
    if (teamType !== "all") params.set("teamType", teamType);
    const res = await fetch(`/api/admin/segmentation?${params}`);
    const d = await res.json();
    setGlobalData(d);
    setLoading(false);
  }

  useEffect(() => {
    if (selectedIds.length === 1) {
      loadSingle(selectedIds[0]);
    } else if (selectedIds.length >= 2) {
      loadComparison(selectedIds);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, granularite]);

  async function loadSingle(id: string) {
    setSingleLoading(true);
    setSingleData(null);
    const params = new URLSearchParams({ commercialId: id });
    if (granularite !== "mois") params.set("granularite", granularite);
    const res = await fetch(`/api/admin/segmentation?${params}`);
    const d = await res.json();
    setSingleData(d);
    setSingleLoading(false);
  }

  async function loadComparison(ids: string[]) {
    setCompLoading(true);
    const results = await Promise.all(
      ids.map((id) => {
        const params = new URLSearchParams({ commercialId: id });
        if (granularite !== "mois") params.set("granularite", granularite);
        return fetch(`/api/admin/segmentation?${params}`).then((r) => r.json());
      })
    );
    const byId: Record<string, SegData> = {};
    ids.forEach((id, i) => { byId[id] = results[i]; });
    setComparisonData(byId);
    setCompLoading(false);
  }

  function toggleCommercial(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 4) return prev;
      return [...prev, id];
    });
  }

  function clearSelection() {
    setSelectedIds([]);
    setSingleData(null);
    setComparisonData({});
  }

  const allCommerciaux = (globalData?.commerciauxList ?? []).filter(
    (c) => teamType === "all" || c.teamType === teamType
  );

  const selectedCommercials = allCommerciaux.filter((c) => selectedIds.includes(c.id));

  const mode = selectedIds.length === 0 ? "global" : selectedIds.length === 1 ? "single" : "compare";

  return (
    <div className="space-y-5">
      <Header
        title="Segmentation CA"
        subtitle="Analyse du chiffre d'affaires par segment, catégorie et commercial"
      />

      {/* ── Filtres ──────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
        {/* Toggle granularité — toujours visible */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Granularité</label>
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            {(["mois", "semaine", "jour"] as const).map((g) => (
              <button
                key={g}
                onClick={() => { setGranularite(g); setSelectedWeek(""); setSelectedDay(""); setExpandedMois(null); }}
                className={`px-3 py-2 text-sm font-medium transition-colors ${
                  granularite === g ? "bg-[#1E40AF] text-white" : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {g === "mois" ? "Mois" : g === "semaine" ? "Semaine" : "Jour"}
              </button>
            ))}
          </div>
        </div>

        {/* Sélecteur de période — uniquement en mode global */}
        {mode === "global" && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Période</label>
            {granularite === "mois" && (
              <select
                value={mois && annee ? `${mois}/${annee}` : "all"}
                onChange={(e) => {
                  if (e.target.value === "all") { setMois(null); setAnnee(null); }
                  else {
                    const [m, a] = e.target.value.split("/").map(Number);
                    setMois(m); setAnnee(a);
                  }
                }}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="all">Toutes périodes</option>
                {(globalData?.moisDisponibles ?? []).map(({ mois: m, annee: a }) => (
                  <option key={`${m}/${a}`} value={`${m}/${a}`}>
                    {MOIS_NOMS[m - 1]} {a}
                  </option>
                ))}
              </select>
            )}
            {granularite === "semaine" && (
              <div className="flex items-center gap-2">
                <input
                  type="week"
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {selectedWeek && (
                  <button onClick={() => setSelectedWeek("")} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
            {granularite === "jour" && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                {selectedDay && (
                  <button onClick={() => setSelectedDay("")} className="text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Équipe</label>
          <select
            value={teamType}
            onChange={(e) => { setTeamType(e.target.value); clearSelection(); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Toutes équipes</option>
            <option value="TERRAIN">Terrain</option>
            <option value="TELEVENTE">Télévente</option>
          </select>
        </div>

        {/* Vendeurs multi-select */}
        <div className="flex flex-col gap-1" ref={vendorsRef}>
          <label className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Vendeurs</label>
          <div className="relative">
            <button
              onClick={() => setVendorsOpen(!vendorsOpen)}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 bg-white flex items-center gap-2 min-w-[200px] justify-between hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
            >
              <span>
                {selectedIds.length === 0
                  ? "Tous les vendeurs"
                  : selectedIds.length === 1
                  ? selectedCommercials[0]?.name ?? "1 vendeur"
                  : `${selectedIds.length} vendeurs sélectionnés`}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${vendorsOpen ? "rotate-180" : ""}`} />
            </button>

            {vendorsOpen && allCommerciaux.length > 0 && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 min-w-[240px] max-h-72 overflow-y-auto">
                {selectedIds.length > 0 && (
                  <div className="px-3 py-2 border-b border-gray-100">
                    <button
                      onClick={() => { clearSelection(); setVendorsOpen(false); }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                    >
                      Tout déselectionner
                    </button>
                  </div>
                )}
                {allCommerciaux.map((c) => {
                  const checked = selectedIds.includes(c.id);
                  const disabled = !checked && selectedIds.length >= 4;
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors ${
                        checked ? "bg-blue-50" : disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50"
                      }`}
                    >
                      <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        checked ? "bg-[#1E40AF] border-[#1E40AF]" : "border-gray-300 bg-white"
                      }`}>
                        {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => !disabled && toggleCommercial(c.id)}
                        className="sr-only"
                      />
                      <span className="text-sm font-medium text-gray-900 flex-1">{c.name}</span>
                      {c.teamType && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${
                          c.teamType === "TERRAIN"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-violet-100 text-violet-700"
                        }`}>
                          {c.teamType === "TERRAIN" ? "Terrain" : "TV"}
                        </span>
                      )}
                    </label>
                  );
                })}
                {selectedIds.length >= 4 && (
                  <div className="px-3 py-2 border-t border-gray-100 text-xs text-gray-400">
                    Maximum 4 vendeurs pour la comparaison
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Chips sélection */}
        {selectedCommercials.length > 0 && (
          <div className="flex flex-wrap gap-1.5 items-center self-end pb-0.5">
            {selectedCommercials.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-semibold"
              >
                {c.name}
                <button onClick={() => toggleCommercial(c.id)} className="hover:text-blue-600 leading-none">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            {selectedIds.length > 1 && (
              <button
                onClick={clearSelection}
                className="text-xs text-gray-400 hover:text-gray-600 underline"
              >
                Effacer tout
              </button>
            )}
          </div>
        )}

        {loading && <Loader2 className="w-5 h-5 animate-spin text-[#1E40AF] self-center mb-1" />}
      </div>

      {loading && !globalData ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-[#1E40AF]" />
        </div>
      ) : globalData ? (
        <>
          {/* ── VUE GLOBALE ──────────────────────────────────────────────── */}
          {mode === "global" && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm text-gray-500">
                  CA total —{" "}
                  {granularite === "mois"
                    ? (mois && annee ? `${MOIS_NOMS[mois - 1]} ${annee}` : "toutes périodes")
                    : granularite === "semaine"
                    ? (selectedWeek ? `Semaine ${selectedWeek.replace("-W", " — S")}` : "toutes périodes")
                    : (selectedDay
                        ? new Date(selectedDay + "T00:00:00Z").toLocaleDateString("fr-FR", {
                            timeZone: "UTC", day: "2-digit", month: "long", year: "numeric",
                          })
                        : "toutes périodes")
                  }
                </p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{fmt(globalData.totalCA)}</p>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                {globalData.parCategorie.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                      <h3 className="font-semibold text-gray-800">Répartition CA par catégorie</h3>
                    </div>
                    <div className="p-4" style={{ height: 280 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={globalData.parCategorie}
                            dataKey="ca"
                            nameKey="label"
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={100}
                            paddingAngle={2}
                          >
                            {globalData.parCategorie.map((entry) => (
                              <Cell
                                key={entry.label}
                                fill={CAT_CHART_COLORS[entry.label.toLowerCase()] ?? "#6B7280"}
                              />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(v: number | undefined) => fmt(v ?? 0)}
                            contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB", fontSize: "12px" }}
                          />
                          <Legend formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}
                <SegmentationTable
                  title="CA par catégorie client"
                  items={globalData.parCategorie}
                  colorMap={BADGE_COLORS}
                />
              </div>

              {globalData.parCommercial.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800">CA par vendeur</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Cliquez pour voir le détail mensuel · Maj+clic pour comparer jusqu&apos;à 4 vendeurs
                    </p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-xs uppercase tracking-wide">
                        <th className="text-left px-5 py-3 font-semibold w-10">#</th>
                        <th className="text-left px-4 py-3 font-semibold">Vendeur</th>
                        <th className="text-right px-4 py-3 font-semibold">CA</th>
                        <th className="text-right px-4 py-3 font-semibold">Factures</th>
                        <th className="text-right px-5 py-3 font-semibold w-40">Part du CA</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {globalData.parCommercial.map((c, i) => (
                        <tr
                          key={c.id}
                          className={`hover:bg-blue-50 cursor-pointer transition-colors ${
                            selectedIds.includes(c.id) ? "bg-blue-50 ring-1 ring-inset ring-blue-200" : ""
                          }`}
                          onClick={(e) => {
                            if (e.shiftKey) toggleCommercial(c.id);
                            else setSelectedIds([c.id]);
                          }}
                        >
                          <td className="px-5 py-3 text-gray-400 font-mono text-xs">{i + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-[#1E40AF] text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                                {c.name.charAt(0)}
                              </div>
                              <span className="font-medium text-gray-900">{c.name}</span>
                              {c.teamType && (
                                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                                  c.teamType === "TERRAIN" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"
                                }`}>
                                  {c.teamType === "TERRAIN" ? "Terrain" : "Télévente"}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(c.ca)}</td>
                          <td className="px-4 py-3 text-right text-gray-500">{c.nb}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-24 bg-gray-100 rounded-full h-2 flex-shrink-0">
                                <div className="bg-[#1E40AF] h-2 rounded-full" style={{ width: `${Math.min(c.pct, 100)}%` }} />
                              </div>
                              <span className="text-xs font-bold text-gray-700 w-10 text-right">{c.pct}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* ── VUE DÉTAIL COMMERCIAL (1 vendeur) ───────────────────────── */}
          {mode === "single" && (
            <>
              {singleLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-7 h-7 animate-spin text-[#1E40AF]" />
                </div>
              ) : singleData ? (
                <>
                  {/* Header */}
                  {(() => {
                    const singlePeriodes: PeriodeRow[] =
                      granularite !== "mois" && singleData.parPeriode?.length > 0
                        ? singleData.parPeriode
                        : moisToPeriode(singleData.parMois);
                    const periodeLabel =
                      granularite === "mois" ? "mois" : granularite === "semaine" ? "semaines" : "jours";
                    const pivotTitle =
                      granularite === "mois"
                        ? "Évolution mensuelle par catégorie client"
                        : granularite === "semaine"
                        ? "Évolution hebdomadaire par catégorie client"
                        : "Évolution journalière par catégorie client";
                    return (
                    <>
                  <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                    <div className="w-12 h-12 bg-[#1E40AF] text-white rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0">
                      {selectedCommercials[0]?.name.charAt(0) ?? "?"}
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Vendeur</p>
                      <p className="text-xl font-bold text-gray-900">{selectedCommercials[0]?.name ?? "—"}</p>
                      <p className="text-sm text-gray-500">
                        CA total :{" "}
                        <span className="font-semibold text-gray-800">
                          {fmt(singlePeriodes.reduce((s, r) => s + r.total, 0))}
                        </span>
                        &nbsp;·&nbsp;{singlePeriodes.length} {periodeLabel} d&apos;activité
                      </p>
                    </div>
                    {selectedCommercials[0]?.teamType && (
                      <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${
                        selectedCommercials[0].teamType === "TERRAIN" ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"
                      }`}>
                        {selectedCommercials[0].teamType === "TERRAIN" ? "Terrain" : "Télévente"}
                      </span>
                    )}
                    <button
                      onClick={clearSelection}
                      className="ml-auto text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Pivot par période — du plus récent au plus ancien */}
                  <PivotTable
                    title={pivotTitle}
                    rows={[...singlePeriodes].reverse()}
                    colKey="parCategorie"
                    colorFn={(k) => CAT_PIVOT_COLORS[k] ?? "text-gray-700"}
                  />

                  {/* Résumé global par catégorie */}
                  <SegmentationTable
                    title="Résumé global par catégorie"
                    items={singleData.parCategorie}
                    colorMap={BADGE_COLORS}
                  />
                  </>
                  );
                  })()}
                </>
              ) : null}
            </>
          )}

          {/* ── VUE COMPARAISON (2-4 vendeurs) ──────────────────────────── */}
          {mode === "compare" && (
            <>
              {compLoading ? (
                <div className="flex items-center justify-center py-20">
                  <Loader2 className="w-7 h-7 animate-spin text-[#1E40AF]" />
                </div>
              ) : Object.keys(comparisonData).length > 0 ? (
                <>
                  {/* Header */}
                  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
                    <div className="flex -space-x-2">
                      {selectedCommercials.map((c, i) => (
                        <div
                          key={c.id}
                          className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white ring-2 ring-white"
                          style={{ background: COMPARISON_COLORS[i] }}
                        >
                          {c.name.charAt(0)}
                        </div>
                      ))}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">
                        {selectedCommercials.map((c) => c.name).join(" vs ")}
                      </p>
                      <p className="text-xs text-gray-400">Retirez un vendeur dans le filtre pour voir son détail individuel</p>
                    </div>
                    <button
                      onClick={clearSelection}
                      className="ml-auto text-gray-400 hover:text-gray-600 p-1.5 rounded-full hover:bg-gray-100 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* KPI totaux par vendeur */}
                  <div className={`grid gap-4 ${selectedCommercials.length === 2 ? "grid-cols-2" : selectedCommercials.length === 3 ? "grid-cols-3" : "grid-cols-4"}`}>
                    {selectedCommercials.map((c, i) => {
                      const periodes = getComparePeriodes(c.id);
                      const totalCA = periodes.reduce((s, r) => s + r.total, 0);
                      const pl = granularite === "mois" ? "mois" : granularite === "semaine" ? "semaines" : "jours";
                      return (
                        <div key={c.id} className="bg-white rounded-xl border border-gray-200 p-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-5 h-5 rounded-full text-xs font-bold text-white flex items-center justify-center flex-shrink-0"
                              style={{ background: COMPARISON_COLORS[i] }}
                            >
                              {c.name.charAt(0)}
                            </div>
                            <span className="text-sm font-semibold text-gray-900 truncate">{c.name}</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-900">{fmt(totalCA)}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{periodes.length} {pl} · CA total</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tableau croisé par période — clic = détail de segmentation */}
                  {(() => {
                    const periodeMap = new Map<string, { key: string; label: string }>();
                    selectedIds.forEach((id) => {
                      getComparePeriodes(id).forEach((r) => {
                        if (!periodeMap.has(r.key)) periodeMap.set(r.key, { key: r.key, label: r.label });
                      });
                    });
                    const periodeRows = Array.from(periodeMap.entries())
                      .sort((a, b) => b[0].localeCompare(a[0]))
                      .map(([, v]) => v);
                    if (!periodeRows.length) return null;

                    const colSpan = selectedCommercials.length + 2;
                    const evolLabel =
                      granularite === "mois" ? "mensuelle" : granularite === "semaine" ? "hebdomadaire" : "journalière";

                    // Mini-tableau de segmentation pour une période donnée
                    function BreakdownTable({
                      title,
                      dataKey,
                      rowKey,
                      colorMap,
                    }: {
                      title: string;
                      dataKey: "parCategorie" | "parSousCategorie" | "parType";
                      rowKey: string;
                      colorMap?: Record<string, string>;
                    }) {
                      const allLabels = Array.from(new Set(
                        selectedCommercials.flatMap((c) => {
                          const pr = getComparePeriodes(c.id).find((r) => r.key === rowKey);
                          return Object.keys(pr?.[dataKey] ?? {});
                        })
                      )).sort((a, b) => {
                        const totA = selectedCommercials.reduce((s, c) => {
                          const pr = getComparePeriodes(c.id).find((r) => r.key === rowKey);
                          return s + (pr?.[dataKey][a] ?? 0);
                        }, 0);
                        const totB = selectedCommercials.reduce((s, c) => {
                          const pr = getComparePeriodes(c.id).find((r) => r.key === rowKey);
                          return s + (pr?.[dataKey][b] ?? 0);
                        }, 0);
                        return totB - totA;
                      });
                      if (!allLabels.length) return null;
                      return (
                        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                          <div className="px-3 py-2 bg-gray-50 border-b border-gray-100">
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{title}</p>
                          </div>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-gray-100 text-gray-500">
                                <th className="text-left px-3 py-1.5 font-semibold">Segment</th>
                                {selectedCommercials.map((c, i) => (
                                  <th key={c.id} className="text-right px-2 py-1.5 font-semibold whitespace-nowrap" style={{ color: COMPARISON_COLORS[i] }}>
                                    {c.name}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {allLabels.map((lbl) => (
                                <tr key={lbl} className="hover:bg-gray-50">
                                  <td className="px-3 py-1.5">
                                    {colorMap ? (
                                      <span className={`px-1.5 py-0.5 rounded-full text-xs font-medium ${colorMap[lbl.toLowerCase()] ?? "bg-gray-100 text-gray-600"}`}>
                                        {lbl}
                                      </span>
                                    ) : (
                                      <span className="text-gray-700">{lbl}</span>
                                    )}
                                  </td>
                                  {selectedCommercials.map((c) => {
                                    const pr = getComparePeriodes(c.id).find((r) => r.key === rowKey);
                                    const val = pr?.[dataKey][lbl] ?? 0;
                                    return (
                                      <td key={c.id} className="px-2 py-1.5 text-right">
                                        {val > 0 ? <span className="font-semibold text-gray-900">{fmt(val)}</span> : <span className="text-gray-200">—</span>}
                                      </td>
                                    );
                                  })}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      );
                    }

                    return (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                          <h3 className="font-semibold text-gray-800">Évolution {evolLabel} — CA total par vendeur</h3>
                          <p className="text-xs text-gray-400 mt-0.5">Cliquez sur une période pour voir la segmentation détaillée</p>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wide text-gray-600">
                                <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Période</th>
                                {selectedCommercials.map((c, i) => (
                                  <th key={c.id} className="text-right px-4 py-3 font-semibold whitespace-nowrap">
                                    <span className="flex items-center justify-end gap-1.5">
                                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COMPARISON_COLORS[i] }} />
                                      {c.name}
                                    </span>
                                  </th>
                                ))}
                                <th className="text-right px-5 py-3 font-bold whitespace-nowrap border-l border-gray-200">Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {periodeRows.flatMap((row) => {
                                const key = row.key;
                                const isOpen = expandedMois === key;
                                const rowTotal = selectedIds.reduce((s, id) => {
                                  const found = getComparePeriodes(id).find((r) => r.key === key);
                                  return s + (found?.total ?? 0);
                                }, 0);
                                const result = [
                                  <tr
                                    key={key}
                                    className={`cursor-pointer border-b border-gray-100 transition-colors ${isOpen ? "bg-blue-50" : "hover:bg-blue-50/40"}`}
                                    onClick={() => setExpandedMois(isOpen ? null : key)}
                                  >
                                    <td className="px-5 py-2.5 whitespace-nowrap">
                                      <span className="flex items-center gap-2 font-semibold text-gray-800">
                                        <ChevronRight className={`w-3.5 h-3.5 text-gray-400 transition-transform flex-shrink-0 ${isOpen ? "rotate-90" : ""}`} />
                                        {row.label}
                                      </span>
                                    </td>
                                    {selectedCommercials.map((c, i) => {
                                      const found = getComparePeriodes(c.id).find((r) => r.key === key);
                                      return (
                                        <td key={c.id} className="px-4 py-2.5 text-right whitespace-nowrap">
                                          {found ? (
                                            <span className="font-medium" style={{ color: COMPARISON_COLORS[i] }}>{fmt(found.total)}</span>
                                          ) : (
                                            <span className="text-gray-200">—</span>
                                          )}
                                        </td>
                                      );
                                    })}
                                    <td className="px-5 py-2.5 text-right font-bold text-gray-900 whitespace-nowrap border-l border-gray-200">
                                      {fmt(rowTotal)}
                                    </td>
                                  </tr>,
                                ];
                                if (isOpen) {
                                  result.push(
                                    <tr key={`${key}-detail`} className="border-b border-blue-100">
                                      <td colSpan={colSpan} className="px-5 py-4 bg-blue-50/50">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                          <BreakdownTable
                                            title="Par catégorie"
                                            dataKey="parCategorie"
                                            rowKey={key}
                                            colorMap={BADGE_COLORS}
                                          />
                                          <BreakdownTable
                                            title="Par sous-catégorie"
                                            dataKey="parSousCategorie"
                                            rowKey={key}
                                          />
                                          <BreakdownTable
                                            title="Par type client"
                                            dataKey="parType"
                                            rowKey={key}
                                          />
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }
                                return result;
                              })}
                            </tbody>
                            <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                              <tr>
                                <td className="px-5 py-3 font-bold text-gray-700 text-xs uppercase">Total</td>
                                {selectedCommercials.map((c) => {
                                  const total = getComparePeriodes(c.id).reduce((s, r) => s + r.total, 0);
                                  return (
                                    <td key={c.id} className="px-4 py-3 text-right font-bold text-gray-900 whitespace-nowrap">
                                      {fmt(total)}
                                    </td>
                                  );
                                })}
                                <td className="px-5 py-3 text-right font-bold text-gray-900 border-l border-gray-200">
                                  {fmt(selectedIds.reduce((s, id) => s + getComparePeriodes(id).reduce((ss, r) => ss + r.total, 0), 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Graphique barres groupées par catégorie */}
                  {(() => {
                    const cats = Array.from(new Set(
                      selectedIds.flatMap((id) => (comparisonData[id]?.parCategorie ?? []).map((x) => x.label))
                    ));
                    const chartData = cats.map((cat) => {
                      const row: Record<string, string | number> = { cat };
                      selectedCommercials.forEach((c) => {
                        const found = comparisonData[c.id]?.parCategorie.find((x) => x.label === cat);
                        row[c.name] = found?.ca ?? 0;
                      });
                      return row;
                    });
                    return (
                      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                        <div className="px-5 py-4 border-b border-gray-100">
                          <h3 className="font-semibold text-gray-800">CA par catégorie client — comparaison</h3>
                        </div>
                        <div className="p-4" style={{ height: 300 }}>
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                              <XAxis dataKey="cat" tick={{ fontSize: 11 }} />
                              <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`} tick={{ fontSize: 11 }} />
                              <Tooltip
                                formatter={(v: number | undefined) => fmt(v ?? 0)}
                                contentStyle={{ borderRadius: "8px", border: "1px solid #E5E7EB", fontSize: "12px" }}
                              />
                              <Legend />
                              {selectedCommercials.map((c, i) => (
                                <Bar key={c.id} dataKey={c.name} fill={COMPARISON_COLORS[i]} radius={[3, 3, 0, 0]} />
                              ))}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    );
                  })()}
                </>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </div>
  );
}
