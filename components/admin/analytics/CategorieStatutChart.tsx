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

interface Props {
  data: { statut: string; ca: number }[];
}

const STATUT_COLORS: Record<string, string> = {
  "Clients stratégiques": "#1E3A8A",
  "Clients réguliers": "#16A34A",
  "Clients occasionnels": "#D97706",
  "Nouveaux": "#7C3AED",
  "Perdus": "#DC2626",
  "Prospect": "#6B7280",
};

function getColor(statut: string): string {
  for (const [key, color] of Object.entries(STATUT_COLORS)) {
    if (statut.toLowerCase().includes(key.toLowerCase().split(" ").pop()!)) {
      return color;
    }
  }
  return STATUT_COLORS[statut] ?? "#94A3B8";
}

function formatCA(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k€`;
  return `${v}€`;
}

export default function CategorieStatutChart({ data }: Props) {
  if (!data.length) {
    return <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis
          dataKey="statut"
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
        <Bar dataKey="ca" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={getColor(entry.statut)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
