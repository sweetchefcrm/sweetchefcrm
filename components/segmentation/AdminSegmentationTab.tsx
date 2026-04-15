"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import SegmentationTable from "./SegmentationTable";

const MOIS_NOMS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const CATEGORY_COLORS: Record<string, string> = {
  "stratégiques":  "bg-blue-100 text-blue-800",
  "stratégique":   "bg-blue-100 text-blue-800",
  "réguliers":     "bg-green-100 text-green-800",
  "régulier":      "bg-green-100 text-green-800",
  "occasionnels":  "bg-amber-100 text-amber-800",
  "occasionnel":   "bg-amber-100 text-amber-800",
  "nouveaux":      "bg-violet-100 text-violet-800",
  "nouveau":       "bg-violet-100 text-violet-800",
  "perdus":        "bg-red-100 text-red-800",
  "perdu":         "bg-red-100 text-red-800",
  "prospect":      "bg-gray-100 text-gray-500",
};

// Couleur de fond pour chaque catégorie dans la table pivot
const CAT_PIVOT_COLORS: Record<string, string> = {
  "stratégiques": "text-blue-700",
  "stratégique":  "text-blue-700",
  "réguliers":    "text-green-700",
  "régulier":     "text-green-700",
  "occasionnels": "text-amber-700",
  "occasionnel":  "text-amber-700",
  "nouveaux":     "text-violet-700",
  "nouveau":      "text-violet-700",
  "perdus":       "text-red-600",
  "perdu":        "text-red-600",
  "prospect":     "text-gray-400",
};

interface SegItem { label: string; ca: number; nb: number; pct: number; }
interface CommercialItem extends SegItem { id: string; name: string; teamType: string | null; }
interface MoisRow {
  mois: number;
  annee: number;
  label: string;
  total: number;
  nb: number;
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
  totalCA: number;
  commerciauxList: { id: string; name: string; teamType: string | null }[];
  moisDisponibles: { mois: number; annee: number }[];
}

function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

function PivotTable({
  title,
  rows,
  colKey,
  colorFn,
}: {
  title: string;
  rows: MoisRow[];
  colKey: "parCategorie" | "parSousCategorie" | "parType";
  colorFn?: (key: string) => string;
}) {
  // Collecter toutes les colonnes uniques, triées par CA total décroissant
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
        <p className="text-xs text-gray-400 mt-0.5">Un ligne par mois · colonnes = segments</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-gray-600 text-xs uppercase tracking-wide">
              <th className="text-left px-5 py-3 font-semibold whitespace-nowrap">Mois</th>
              {cols.map((col) => (
                <th key={col} className={`text-right px-4 py-3 font-semibold whitespace-nowrap ${colorFn ? colorFn(col.toLowerCase()) : ""}`}>
                  {col}
                </th>
              ))}
              <th className="text-right px-5 py-3 font-bold whitespace-nowrap border-l border-gray-200">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row) => (
              <tr key={`${row.mois}-${row.annee}`} className="hover:bg-blue-50/40">
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

export default function AdminSegmentationTab() {
  const [data, setData] = useState<SegData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mois, setMois] = useState<number | null>(null);
  const [annee, setAnnee] = useState<number | null>(null);
  const [commercialId, setCommercialId] = useState("all");
  const [teamType, setTeamType] = useState("all");

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mois, annee, commercialId, teamType]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (mois && annee) { params.set("mois", String(mois)); params.set("annee", String(annee)); }
    if (commercialId !== "all") params.set("commercialId", commercialId);
    if (teamType !== "all") params.set("teamType", teamType);
    const res = await fetch(`/api/admin/segmentation?${params}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }

  const filteredCommerciaux = (data?.commerciauxList ?? []).filter(
    (c) => teamType === "all" || c.teamType === teamType
  );

  const selectedCommercial = commercialId !== "all"
    ? data?.commerciauxList.find((c) => c.id === commercialId)
    : null;

  const isCommercialSelected = commercialId !== "all";

  return (
    <div className="space-y-5">
      {/* Filtres */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
        {/* Période — visible seulement en mode global (pas quand vendeur sélectionné : on montre tous les mois) */}
        {!isCommercialSelected && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Période</label>
            <select
              value={mois && annee ? `${mois}/${annee}` : "all"}
              onChange={(e) => {
                if (e.target.value === "all") { setMois(null); setAnnee(null); }
                else {
                  const [m, a] = e.target.value.split("/").map(Number);
                  setMois(m); setAnnee(a);
                }
              }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">Toutes périodes</option>
              {(data?.moisDisponibles ?? []).map(({ mois: m, annee: a }) => (
                <option key={`${m}/${a}`} value={`${m}/${a}`}>
                  {MOIS_NOMS[m - 1]} {a}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Équipe</label>
          <select
            value={teamType}
            onChange={(e) => { setTeamType(e.target.value); setCommercialId("all"); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Toutes équipes</option>
            <option value="TERRAIN">Terrain</option>
            <option value="TELEVENTE">Télévente</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Vendeur</label>
          <select
            value={commercialId}
            onChange={(e) => { setCommercialId(e.target.value); setMois(null); setAnnee(null); }}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="all">Tous les vendeurs</option>
            {filteredCommerciaux.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {loading && <Loader2 className="w-5 h-5 animate-spin text-[#1E40AF] self-center mb-1" />}
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-[#1E40AF]" />
        </div>
      ) : data ? (
        <>
          {/* ── Vue vendeur : breakdown mensuel ──────────────────────────── */}
          {isCommercialSelected && data.parMois.length > 0 ? (
            <>
              {/* Header vendeur */}
              <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-center gap-4">
                <div className="w-12 h-12 bg-[#1E40AF] text-white rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0">
                  {selectedCommercial?.name.charAt(0) ?? "?"}
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Vendeur sélectionné</p>
                  <p className="text-xl font-bold text-gray-900">{selectedCommercial?.name ?? "—"}</p>
                  <p className="text-sm text-gray-500">
                    CA total toutes périodes : <span className="font-semibold text-gray-800">{fmt(data.parMois.reduce((s, r) => s + r.total, 0))}</span>
                    &nbsp;·&nbsp;
                    {data.parMois.length} mois d&apos;activité
                  </p>
                </div>
                {selectedCommercial?.teamType && (
                  <span className={`ml-auto text-xs px-2.5 py-1 rounded-full font-semibold ${
                    selectedCommercial.teamType === "TERRAIN"
                      ? "bg-emerald-100 text-emerald-700"
                      : "bg-violet-100 text-violet-700"
                  }`}>
                    {selectedCommercial.teamType === "TERRAIN" ? "Terrain" : "Télévente"}
                  </span>
                )}
              </div>

              {/* Table pivot par catégorie */}
              <PivotTable
                title="Évolution mensuelle — par catégorie client"
                rows={data.parMois}
                colKey="parCategorie"
                colorFn={(k) => CAT_PIVOT_COLORS[k] ?? "text-gray-700"}
              />

              {/* Table pivot par type/groupe */}
              <PivotTable
                title="Évolution mensuelle — par groupe / type client"
                rows={data.parMois}
                colKey="parType"
              />

              {/* Table pivot par sous-catégorie */}
              <PivotTable
                title="Évolution mensuelle — par sous-catégorie"
                rows={data.parMois}
                colKey="parSousCategorie"
              />

              {/* Résumé toutes périodes confondues */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <SegmentationTable
                  title="Résumé global — par catégorie"
                  items={data.parCategorie}
                  colorMap={CATEGORY_COLORS}
                />
                <SegmentationTable
                  title="Résumé global — par sous-catégorie"
                  items={data.parSousCategorie}
                />
              </div>
              <SegmentationTable
                title="Résumé global — par groupe / type client"
                items={data.parType}
              />
            </>
          ) : (
            <>
              {/* ── Vue globale (tous vendeurs ou équipe) ─────────────────── */}
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <p className="text-sm text-gray-500">CA total — période sélectionnée</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{fmt(data.totalCA)}</p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <SegmentationTable title="CA par catégorie client" items={data.parCategorie} colorMap={CATEGORY_COLORS} />
                <SegmentationTable title="CA par sous-catégorie" items={data.parSousCategorie} />
              </div>

              <SegmentationTable title="CA par groupe / type client" items={data.parType} />

              {/* Classement vendeurs */}
              {data.parCommercial.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <h3 className="font-semibold text-gray-800">CA par vendeur</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Cliquez sur un vendeur dans le filtre pour voir son détail mensuel</p>
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
                      {data.parCommercial.map((c, i) => (
                        <tr
                          key={c.id}
                          className="hover:bg-blue-50 cursor-pointer"
                          onClick={() => { setCommercialId(c.id); setMois(null); setAnnee(null); }}
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
                                <div className="bg-[#1E40AF] h-2 rounded-full transition-all" style={{ width: `${Math.min(c.pct, 100)}%` }} />
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
        </>
      ) : null}
    </div>
  );
}
