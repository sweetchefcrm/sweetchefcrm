"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  mois: number;
  annee: number;
  ca: number;
}

const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

interface RevenueChartProps {
  data: DataPoint[];
  title?: string;
}

export default function RevenueChart({ data, title = "Évolution du CA (12 derniers mois)" }: RevenueChartProps) {
  const chartData = data.map((d) => ({
    label: `${MOIS[d.mois - 1]} ${d.annee !== new Date().getFullYear() ? d.annee : ""}`.trim(),
    ca: d.ca,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={chartData} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="caGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#1E40AF" stopOpacity={0.2} />
              <stop offset="95%" stopColor="#1E40AF" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
          />
          <Tooltip
            formatter={(value) =>
              new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value))
            }
          />
          <Area
            type="monotone"
            dataKey="ca"
            stroke="#1E40AF"
            strokeWidth={2}
            fill="url(#caGradient)"
            name="CA"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
