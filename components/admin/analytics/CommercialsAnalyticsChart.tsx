"use client";

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

interface Commercial {
  id: string;
  name: string;
  role: string;
  teamType: string | null;
}

interface CaEntry {
  label: string;
  ca: number;
  commercialId?: string;
  teamType?: string | null;
}

interface EvolutionEntry {
  label: string; // "MM/YYYY"
}

interface Props {
  data: CaEntry[];
  commerciauxList: Commercial[];
  evolutionMonths: EvolutionEntry[]; // pour peupler le sélecteur de mois
  period: "daily" | "monthly";
  commercialId: string;
  teamType: string;
  selectedMonth: string; // "all" ou "MM/YYYY"
  onPeriodChange: (p: "daily" | "monthly") => void;
  onCommercialChange: (id: string) => void;
  onTeamTypeChange: (t: string) => void;
  onMonthChange: (m: string) => void;
}

const TEAM_COLORS: Record<string, string> = {
  TERRAIN: "#1E40AF",
  TELEVENTE: "#059669",
};

function formatCA(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k€`;
  return `${v}€`;
}

function getBarColor(entry: CaEntry): string {
  return TEAM_COLORS[entry.teamType ?? ""] ?? "#6B7280";
}

export default function CommercialsAnalyticsChart({
  data,
  commerciauxList,
  evolutionMonths,
  period,
  commercialId,
  teamType,
  selectedMonth,
  onPeriodChange,
  onCommercialChange,
  onTeamTypeChange,
  onMonthChange,
}: Props) {
  const isAllMode = commercialId === "all";

  return (
    <div className="space-y-4">
      {/* Ligne de filtres */}
      <div className="flex flex-wrap gap-3 items-center">

        {/* Filtre équipe */}
        <div className="flex gap-1">
          {(["all", "TERRAIN", "TELEVENTE"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                onTeamTypeChange(t);
                onCommercialChange("all");
              }}
              className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                teamType === t
                  ? t === "TERRAIN"
                    ? "bg-[#1E40AF] text-white"
                    : t === "TELEVENTE"
                    ? "bg-emerald-600 text-white"
                    : "bg-gray-700 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {t === "all" ? "Toutes équipes" : t === "TERRAIN" ? "Terrain" : "Télévente"}
            </button>
          ))}
        </div>

        <div className="w-px h-5 bg-gray-200" />

        {/* Sélecteur commercial individuel */}
        <select
          value={commercialId}
          onChange={(e) => onCommercialChange(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">Tous les commerciaux</option>
          {commerciauxList
            .filter((c) => teamType === "all" || c.teamType === teamType)
            .map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
        </select>

        {/* Sélecteur de mois — uniquement en mode "tous" */}
        {isAllMode && evolutionMonths.length > 0 && (
          <select
            value={selectedMonth}
            onChange={(e) => onMonthChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Tout l'historique</option>
            {[...evolutionMonths].reverse().map((m) => (
              <option key={m.label} value={m.label}>{m.label}</option>
            ))}
          </select>
        )}

        {/* Période (seulement si commercial spécifique) */}
        {!isAllMode && (
          <div className="flex gap-1">
            {(["monthly", "daily"] as const).map((p) => (
              <button
                key={p}
                onClick={() => onPeriodChange(p)}
                className={`px-3 py-1.5 text-xs rounded-lg font-medium transition-colors ${
                  period === p
                    ? "bg-[#1E40AF] text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {p === "monthly" ? "Mensuel" : "Journalier"}
              </button>
            ))}
          </div>
        )}

        {/* Légende équipes */}
        {isAllMode && (
          <div className="flex gap-4 ml-auto">
            {Object.entries(TEAM_COLORS).map(([team, color]) => (
              <span key={team} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className="w-3 h-3 rounded-full inline-block" style={{ background: color }} />
                {team}
              </span>
            ))}
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-full inline-block bg-gray-400" />
              Sans équipe
            </span>
          </div>
        )}
      </div>

      {/* Titre contextuel */}
      {isAllMode && selectedMonth !== "all" && (
        <p className="text-xs text-gray-500">
          Classement pour <span className="font-semibold text-gray-700">{selectedMonth}</span>
        </p>
      )}

      {/* Chart */}
      {!data.length ? (
        <p className="text-sm text-gray-400 text-center py-8">Aucune donnée pour cette période</p>
      ) : isAllMode ? (
        <ResponsiveContainer width="100%" height={Math.max(280, data.length * 32)}>
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 5, right: 40, left: 130, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
            <XAxis type="number" tickFormatter={formatCA} tick={{ fontSize: 11, fill: "#64748B" }} />
            <YAxis
              type="category"
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748B" }}
              width={125}
            />
            <Tooltip
              formatter={(v: unknown) => [formatCA(Number(v)), "CA"]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="ca" radius={[0, 4, 4, 0]}>
              {data.map((entry, i) => (
                <Cell key={i} fill={getBarColor(entry)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "#64748B" }}
              angle={-35}
              textAnchor="end"
              interval={0}
            />
            <YAxis tickFormatter={formatCA} tick={{ fontSize: 11, fill: "#64748B" }} />
            <Tooltip
              formatter={(v: unknown) => [formatCA(Number(v)), "CA"]}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Bar dataKey="ca" fill="#1E40AF" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
