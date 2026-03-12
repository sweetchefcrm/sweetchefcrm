"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface TopClient {
  id: string;
  nom: string;
  ca: number;
}

export default function TopClientsChart({ data }: { data: TopClient[] }) {
  const chartData = data.map((c) => ({ name: c.nom.split(" ")[0], ca: c.ca }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Top 10 clients par CA (mois)</h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData} margin={{ top: 4, right: 10, bottom: 20, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" tickLine={false} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
          />
          <Tooltip
            formatter={(v) =>
              new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(v))
            }
          />
          <Bar dataKey="ca" fill="#1E40AF" radius={[4, 4, 0, 0]} name="CA" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
