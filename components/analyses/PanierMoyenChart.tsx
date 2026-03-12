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

interface PanierEntry {
  id: string;
  name: string;
  teamType: string | null;
  panierMoyen: number;
  nbVentes: number;
}

const teamColors: Record<string, string> = {
  TERRAIN: "#059669",
  TELEVENTE: "#7C3AED",
};

function formatCurrency(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function PanierMoyenChart({ data }: { data: PanierEntry[] }) {
  const chartData = data.map((c) => ({
    name: c.name.split(" ")[0],
    fullName: c.name,
    panierMoyen: c.panierMoyen,
    nbVentes: c.nbVentes,
    teamType: c.teamType,
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">
        Panier moyen par commercial (année)
      </h3>
      {data.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 10, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              angle={-30}
              textAnchor="end"
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(1)}k€`}
            />
            <Tooltip
              formatter={(v, _, props) => [
                formatCurrency(Number(v)),
                `${props.payload?.fullName} (${props.payload?.nbVentes} ventes)`,
              ]}
            />
            <Bar dataKey="panierMoyen" radius={[4, 4, 0, 0]} name="Panier moyen">
              {chartData.map((entry, idx) => (
                <Cell
                  key={idx}
                  fill={entry.teamType ? teamColors[entry.teamType] ?? "#3B82F6" : "#3B82F6"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
