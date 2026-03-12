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
  data: { type: string; ca: number }[];
}

const TYPE_COLORS = [
  "#1E40AF", "#0891B2", "#059669", "#D97706", "#DC2626",
  "#7C3AED", "#DB2777", "#65A30D", "#0F766E", "#B45309",
  "#6D28D9", "#9F1239",
];

function formatCA(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(0)}k€`;
  return `${v}€`;
}

export default function CategorieTypeChart({ data }: Props) {
  if (!data.length) {
    return <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 40, left: 120, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
        <XAxis type="number" tickFormatter={formatCA} tick={{ fontSize: 11, fill: "#64748B" }} />
        <YAxis
          type="category"
          dataKey="type"
          tick={{ fontSize: 11, fill: "#64748B" }}
          width={115}
        />
        <Tooltip
          formatter={(v: unknown) => [formatCA(Number(v)), "CA"]}
          contentStyle={{ fontSize: 12, borderRadius: 8 }}
        />
        <Bar dataKey="ca" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
