"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type ClientMetrage = {
  id: string;
  nom: string;
  codeClient: string;
  lineaire: number | null;
  caAnnuel: number;
  caMetre: number | null;
};

type TooltipProps = {
  active?: boolean;
  payload?: { payload: ClientMetrage & { x: number; y: number } }[];
};

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-3 text-sm">
      <p className="font-semibold text-gray-900">{d.nom}</p>
      <p className="text-gray-500 text-xs">{d.codeClient}</p>
      <div className="mt-2 space-y-1">
        <p className="text-gray-700">
          Métrage : <span className="font-medium">{d.x} m</span>
        </p>
        <p className="text-gray-700">
          CA : <span className="font-medium">{d.y.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</span>
        </p>
        {d.caMetre !== null && (
          <p className="text-blue-700">
            CA/m : <span className="font-bold">{d.caMetre.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}</span>
          </p>
        )}
      </div>
    </div>
  );
}

export default function ScatterPlot({ clients }: { clients: ClientMetrage[] }) {
  const data = clients
    .filter((c) => c.lineaire !== null && c.lineaire !== undefined && c.lineaire > 0)
    .map((c) => ({
      ...c,
      x: c.lineaire as number,
      y: c.caAnnuel,
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
        Aucun client avec un métrage renseigné
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <ScatterChart margin={{ top: 10, right: 20, left: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          type="number"
          dataKey="x"
          name="Métrage"
          unit=" m"
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          label={{ value: "Métrage (m)", position: "insideBottom", offset: -5, fontSize: 12, fill: "#9CA3AF" }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="CA Annuel"
          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
          tick={{ fontSize: 12 }}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
        <Scatter data={data} fill="#3B82F6" fillOpacity={0.75} r={6} />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
