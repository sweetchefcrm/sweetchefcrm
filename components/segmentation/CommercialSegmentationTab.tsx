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

interface SegItem { label: string; ca: number; nb: number; pct: number; }
interface SegData {
  parCategorie: SegItem[];
  parSousCategorie: SegItem[];
  parType: SegItem[];
  totalCA: number;
  moisDisponibles: { mois: number; annee: number }[];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function CommercialSegmentationTab({ commercialId }: { commercialId: string }) {
  const [data, setData] = useState<SegData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mois, setMois] = useState<number | null>(null);
  const [annee, setAnnee] = useState<number | null>(null);

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commercialId, mois, annee]);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (mois && annee) {
      params.set("mois", String(mois));
      params.set("annee", String(annee));
    }
    const res = await fetch(`/api/commercial/${commercialId}/segmentation?${params}`);
    const d = await res.json();
    setData(d);
    setLoading(false);
  }

  return (
    <div className="space-y-5">
      {/* Filtre période */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Période</label>
          <select
            value={mois && annee ? `${mois}/${annee}` : "all"}
            onChange={(e) => {
              if (e.target.value === "all") {
                setMois(null);
                setAnnee(null);
              } else {
                const [m, a] = e.target.value.split("/").map(Number);
                setMois(m);
                setAnnee(a);
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

        {loading && (
          <Loader2 className="w-5 h-5 animate-spin text-[#1E40AF] self-center mb-1" />
        )}
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-7 h-7 animate-spin text-[#1E40AF]" />
        </div>
      ) : data ? (
        <>
          {/* KPI total */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500">CA total — période sélectionnée</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">
              {formatCurrency(data.totalCA)}
            </p>
          </div>

          {/* Catégorie + Sous-catégorie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <SegmentationTable
              title="CA par catégorie client"
              items={data.parCategorie}
              colorMap={CATEGORY_COLORS}
            />
            <SegmentationTable
              title="CA par sous-catégorie"
              items={data.parSousCategorie}
            />
          </div>

          {/* Groupes / type */}
          <SegmentationTable
            title="CA par groupe / type client"
            items={data.parType}
          />
        </>
      ) : null}
    </div>
  );
}
