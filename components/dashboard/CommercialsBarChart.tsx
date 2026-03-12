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

interface CommercialEntry {
  id: string;
  name: string;
  teamType: string | null;
  ca: number;
}

interface CommercialsBarChartProps {
  data: CommercialEntry[];
}

function formatCurrency(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

const teamColors: Record<string, string> = {
  TERRAIN: "#059669",
  TELEVENTE: "#7C3AED",
};

export default function CommercialsBarChart({ data }: CommercialsBarChartProps) {
  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">CA par commercial (mois courant)</h3>
        <p className="text-sm text-gray-400 text-center py-8">Aucune donnée ce mois</p>
      </div>
    );
  }

  const chartData = data.map((c) => ({
    name: c.name.split(" ")[0],
    fullName: c.name,
    ca: c.ca,
    teamType: c.teamType,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">CA par commercial (mois courant)</h3>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-emerald-600" />
            Terrain
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-violet-600" />
            Télévente
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-blue-500" />
            Autre
          </span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 28)}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 4, right: 60, bottom: 0, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11 }}
            tickLine={false}
            width={72}
          />
          <Tooltip
            formatter={(v, _, props) => [
              formatCurrency(Number(v)),
              props.payload?.fullName || "CA",
            ]}
          />
          <Bar dataKey="ca" radius={[0, 4, 4, 0]} name="CA" label={{ position: "right", fontSize: 10, formatter: (v: unknown) => formatCurrency(Number(v)) }}>
            {chartData.map((entry, idx) => (
              <Cell
                key={idx}
                fill={
                  entry.teamType
                    ? teamColors[entry.teamType] ?? "#3B82F6"
                    : "#3B82F6"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
