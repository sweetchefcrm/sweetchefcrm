"use client";

import {
  ComposedChart,
  Area,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
  Legend,
} from "recharts";

interface EvolutionEntry {
  label: string;
  ca: number;
  diff: number | null;
  diffPct: number | null;
}

interface Props {
  data: EvolutionEntry[];
}

function formatCA(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k€`;
  return `${v}€`;
}

function formatDiff(v: number): string {
  const sign = v > 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}%`;
}

function CustomTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { name: string; value: number; payload: EvolutionEntry }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const entry = payload[0]?.payload;
  if (!entry) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs space-y-1">
      <p className="font-semibold text-gray-800 mb-1.5">{label}</p>
      <p className="text-gray-600">
        CA : <span className="font-semibold text-gray-900">{formatCA(entry.ca)}</span>
      </p>
      {entry.diff !== null && (
        <p className="text-gray-600">
          Variation : <span className={`font-semibold ${entry.diff >= 0 ? "text-green-600" : "text-red-600"}`}>
            {entry.diff >= 0 ? "+" : ""}{formatCA(entry.diff)}
          </span>
        </p>
      )}
      {entry.diffPct !== null && (
        <p className="text-gray-600">
          Évolution : <span className={`font-semibold ${entry.diffPct >= 0 ? "text-green-600" : "text-red-600"}`}>
            {formatDiff(entry.diffPct)}
          </span>
        </p>
      )}
    </div>
  );
}

export default function EvolutionMensuelleChart({ data }: Props) {
  if (!data.length) {
    return <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>;
  }

  return (
    <div className="space-y-1">
      {/* Légende rapide */}
      <div className="flex gap-5 text-xs text-gray-500 mb-2">
        <span className="flex items-center gap-1.5">
          <span className="w-8 h-0.5 bg-[#1E40AF] inline-block rounded" />
          CA mensuel
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
          Hausse
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500 inline-block" />
          Baisse
        </span>
      </div>

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data} margin={{ top: 5, right: 60, left: 10, bottom: 55 }}>
          <defs>
            <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1E40AF" stopOpacity={0.15} />
              <stop offset="95%" stopColor="#1E40AF" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />

          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#64748B" }}
            angle={-40}
            textAnchor="end"
            interval={0}
          />

          {/* Axe gauche : CA */}
          <YAxis
            yAxisId="ca"
            tickFormatter={formatCA}
            tick={{ fontSize: 11, fill: "#64748B" }}
            width={60}
          />

          {/* Axe droit : variation % */}
          <YAxis
            yAxisId="diff"
            orientation="right"
            tickFormatter={(v) => `${v > 0 ? "+" : ""}${v}%`}
            tick={{ fontSize: 10, fill: "#94A3B8" }}
            width={48}
          />

          <Tooltip content={<CustomTooltip />} />

          <ReferenceLine yAxisId="diff" y={0} stroke="#CBD5E1" strokeDasharray="4 2" />

          {/* Aire CA */}
          <Area
            yAxisId="ca"
            type="monotone"
            dataKey="ca"
            stroke="#1E40AF"
            strokeWidth={2}
            fill="url(#caGradient)"
            dot={{ r: 3, fill: "#1E40AF", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            name="CA"
          />

          {/* Barres différentiel % */}
          <Bar
            yAxisId="diff"
            dataKey="diffPct"
            maxBarSize={16}
            name="Variation %"
            radius={[2, 2, 0, 0]}
          >
            {data.map((entry, i) => (
              <Cell
                key={i}
                fill={
                  entry.diffPct === null
                    ? "transparent"
                    : entry.diffPct >= 0
                    ? "#16A34A"
                    : "#DC2626"
                }
                fillOpacity={0.75}
              />
            ))}
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
