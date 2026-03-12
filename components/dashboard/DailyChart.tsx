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

interface DailyChartProps {
  data: { jour: number; ca: number }[];
  moisLabel: string;
}

export default function DailyChart({ data, moisLabel }: DailyChartProps) {
  const today = new Date().getDate();

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Évolution journalière — {moisLabel}
      </h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-[200px] text-sm text-gray-400">
          Aucune vente enregistrée ce mois
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="jour"
              tick={{ fontSize: 10 }}
              tickLine={false}
              tickFormatter={(v) => `${v}`}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
            />
            <Tooltip
              formatter={(value) =>
                new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                  Number(value)
                )
              }
              labelFormatter={(l) => `Jour ${l}`}
            />
            <Bar dataKey="ca" radius={[4, 4, 0, 0]} name="CA">
              {data.map((entry) => (
                <Cell
                  key={entry.jour}
                  fill={entry.jour === today ? "#F59E0B" : "#1E40AF"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
