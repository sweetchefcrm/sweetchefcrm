"use client";

import { useState } from "react";
import { X, Check } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type ClientMetrage = {
  id: string;
  nom: string;
  codeClient: string;
  lineaire: number | null;
  commercial: { id: string; name: string };
  caAnnuel: number;
  caParMois: { mois: number; annee: number; total: number }[];
  caMetre: number | null;
};

const MOIS_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

export default function MetrageModal({
  client,
  canEdit,
  onClose,
  onMetrageUpdate,
}: {
  client: ClientMetrage;
  canEdit: boolean;
  onClose: () => void;
  onMetrageUpdate: (id: string, lineaire: number | null) => void;
}) {
  const annee = new Date().getFullYear();

  // Préparer 12 mois de données
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const moisNum = i + 1;
    const found = client.caParMois.find((c) => c.mois === moisNum && c.annee === annee);
    return { mois: MOIS_LABELS[i], total: found?.total ?? 0 };
  });

  const [editLineaire, setEditLineaire] = useState<string>(
    client.lineaire !== null && client.lineaire !== undefined ? String(client.lineaire) : ""
  );
  const [saving, setSaving] = useState(false);

  const simLineaire = parseFloat(editLineaire.replace(",", "."));
  const simCaMetre = !isNaN(simLineaire) && simLineaire > 0 ? Math.round(client.caAnnuel / simLineaire) : null;

  async function handleSave() {
    const val = editLineaire.trim() === "" ? null : simLineaire;
    if (val !== null && (isNaN(val) || val < 0)) return;
    setSaving(true);
    await onMetrageUpdate(client.id, val);
    setSaving(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{client.nom}</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              {client.codeClient} · {client.commercial.name}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-xl p-4 text-center">
              <p className="text-xs text-blue-600 font-medium uppercase tracking-wide">CA Annuel</p>
              <p className="text-2xl font-bold text-blue-800 mt-1">
                {client.caAnnuel > 0
                  ? client.caAnnuel.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
                  : "–"}
              </p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Métrage</p>
              <p className="text-2xl font-bold text-gray-800 mt-1">
                {client.lineaire !== null && client.lineaire !== undefined ? `${client.lineaire} m` : "–"}
              </p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 text-center">
              <p className="text-xs text-green-600 font-medium uppercase tracking-wide">CA/m</p>
              <p className="text-2xl font-bold text-green-800 mt-1">
                {client.caMetre !== null
                  ? client.caMetre.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
                  : "–"}
              </p>
            </div>
          </div>

          {/* BarChart mensuel */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">CA mensuel {annee}</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="mois" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={35}
                />
                <Tooltip
                  formatter={(value: number | undefined) =>
                    value !== undefined
                      ? value.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
                      : "–"
                  }
                  labelStyle={{ fontWeight: 600 }}
                  contentStyle={{ borderRadius: 8, border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.12)" }}
                />
                <Bar dataKey="total" fill="#3B82F6" radius={[4, 4, 0, 0]} name="CA" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Édition métrage + simulation */}
          {canEdit && (
            <div className="border border-gray-200 rounded-xl p-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">Modifier le métrage</h3>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={editLineaire}
                  onChange={(e) => setEditLineaire(e.target.value)}
                  placeholder="Ex: 1.5"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
                <span className="text-sm text-gray-500">mètres linéaires</span>
              </div>

              {simCaMetre !== null && client.caAnnuel > 0 && (
                <div className="bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
                  Avec <strong>{editLineaire} m</strong> → CA/m ={" "}
                  <strong>
                    {simCaMetre.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                  </strong>
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                <Check className="w-4 h-4" />
                {saving ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
