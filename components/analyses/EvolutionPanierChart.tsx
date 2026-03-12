"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface DataPoint {
  label: string;
  panierMoyen: number;
  nbVentes: number;
}

export default function EvolutionPanierChart({ data }: { data: DataPoint[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Évolution du panier moyen (12 mois)
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}k€`}
            />
            <Tooltip
              formatter={(v, _, props) => [
                new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                  Number(v)
                ),
                `Panier moyen (${props.payload?.nbVentes} ventes)`,
              ]}
            />
            <Line
              type="monotone"
              dataKey="panierMoyen"
              stroke="#F59E0B"
              strokeWidth={2}
              dot={{ fill: "#F59E0B", r: 4 }}
              name="Panier moyen"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
