"use client";

import { useEffect, useState, useRef } from "react";
import {
  X,
  Loader2,
  Save,
  Check,
  Pencil,
  History,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import type { ClientFacing } from "./FacingTable";

type HistoryEntry = {
  id: string;
  mois: string;
  nbFacings: number;
  reference: number | null;
  evolution: number | null;
  caMensuel: number;
  caParFacing: number;
};

const MOIS_LABELS = [
  "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
  "Juil", "Août", "Sep", "Oct", "Nov", "Déc",
];

function formatMois(dateStr: string) {
  const d = new Date(dateStr);
  return `${MOIS_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function EvoBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-300 text-xs">–</span>;
  if (value > 0) return <span className="text-green-600 font-semibold text-xs">+{value}%</span>;
  if (value < 0) return <span className="text-red-500 font-semibold text-xs">{value}%</span>;
  return <span className="text-gray-400 text-xs">0%</span>;
}

export default function FacingModal({
  client,
  canEdit,
  canEditAll,
  selectedMois,
  onClose,
  onSaved,
}: {
  client: ClientFacing;
  canEdit: boolean;     // commercial can add for own clients
  canEditAll: boolean;  // admin/chef can also modify existing entries
  selectedMois: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Add form
  const [newFacings, setNewFacings] = useState("");
  const [newMois, setNewMois] = useState(selectedMois);
  const inputRef = useRef<HTMLInputElement>(null);

  // Inline edit state (admin only)
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");

  useEffect(() => {
    loadHistory();
  }, [client.id]);

  // Auto-focus the facings input
  useEffect(() => {
    if (!loading && canEdit) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, canEdit]);

  // Pre-fill if a facing already exists for the selected month
  useEffect(() => {
    if (history.length === 0) return;
    const [yr, mo] = newMois.split("-").map(Number);
    const existing = history.find((h) => {
      const d = new Date(h.mois);
      return d.getUTCFullYear() === yr && d.getUTCMonth() + 1 === mo;
    });
    if (existing) setNewFacings(String(existing.nbFacings));
  }, [history, newMois]);

  function loadHistory() {
    setLoading(true);
    fetch(`/api/facing/${client.id}`)
      .then((r) => (r.ok ? r.json() : { history: [], caParMois: [] }))
      .then((d) => {
        setHistory(d.history ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }

  async function handleSave() {
    if (!newFacings || !newMois) return;
    setSaving(true);
    const res = await fetch("/api/facing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: client.id,
        nbFacings: parseInt(newFacings),
        mois: newMois + "-01",
      }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      loadHistory();
      setTimeout(() => {
        setSaved(false);
        onSaved();
      }, 800);
    }
  }

  async function handleEditEntry(entryId: string) {
    const val = parseInt(editingValue);
    if (isNaN(val) || val < 0) { setEditingEntryId(null); return; }
    const entry = history.find((h) => h.id === entryId);
    if (!entry) { setEditingEntryId(null); return; }
    const d = new Date(entry.mois);
    const moisStr = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    await fetch("/api/facing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clientId: client.id, nbFacings: val, mois: moisStr + "-01" }),
    });
    setEditingEntryId(null);
    loadHistory();
    onSaved();
  }

  const latest = history[history.length - 1] ?? null;
  const reference = history.length >= 2 ? history[history.length - 2] : null;

  const chartData = history.map((h) => ({
    name: formatMois(h.mois),
    Facings: h.nbFacings,
    Référence: h.reference,
  }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{client.nom}</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              {client.codeClient}
              {client.categorieType && (
                <span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700">
                  {client.categorieType}
                </span>
              )}
              <span className="ml-2">• {client.commercial.name}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 ml-4">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* ─── FORMULAIRE AJOUT (en premier, bien visible) ─── */}
          {canEdit && (
            <div className="bg-blue-600 rounded-2xl p-5 text-white">
              <p className="text-sm font-semibold mb-4 opacity-90">
                Saisir / mettre à jour le facing
              </p>
              <div className="flex flex-wrap gap-3 items-end">
                <div>
                  <label className="block text-xs opacity-75 mb-1.5">Mois</label>
                  <input
                    type="month"
                    value={newMois}
                    onChange={(e) => setNewMois(e.target.value)}
                    className="bg-white/15 border border-white/30 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-white/50 [color-scheme:dark]"
                  />
                </div>
                <div>
                  <label className="block text-xs opacity-75 mb-1.5">Nombre de facings</label>
                  <input
                    ref={inputRef}
                    type="number"
                    min="0"
                    step="1"
                    value={newFacings}
                    onChange={(e) => setNewFacings(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSave()}
                    placeholder="ex : 20"
                    className="bg-white/15 border border-white/30 text-white placeholder-white/50 rounded-lg px-3 py-2 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-white/50"
                  />
                </div>
                <button
                  onClick={handleSave}
                  disabled={saving || saved || !newFacings || !newMois}
                  className="flex items-center gap-2 bg-white text-blue-600 font-semibold px-5 py-2 rounded-lg text-sm hover:bg-blue-50 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saved ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  {saved ? "Enregistré !" : "Enregistrer"}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* KPI mini cards */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-blue-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-blue-500 uppercase font-medium mb-1">Facing actuel</p>
                  <p className="text-3xl font-bold text-blue-700">{latest?.nbFacings ?? "–"}</p>
                  {latest && <p className="text-xs text-gray-400 mt-1">{formatMois(latest.mois)}</p>}
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-gray-500 uppercase font-medium mb-1">Référence</p>
                  <p className="text-3xl font-bold text-gray-700">{reference?.nbFacings ?? "–"}</p>
                  {reference && <p className="text-xs text-gray-400 mt-1">{formatMois(reference.mois)}</p>}
                </div>
                <div className="bg-green-50 rounded-xl p-4 text-center">
                  <p className="text-xs text-green-600 uppercase font-medium mb-1">Évolution</p>
                  <p className="text-2xl font-bold">
                    {latest?.evolution !== null && latest?.evolution !== undefined ? (
                      <span className={latest.evolution > 0 ? "text-green-600" : latest.evolution < 0 ? "text-red-500" : "text-gray-500"}>
                        {latest.evolution > 0 ? "+" : ""}{latest.evolution}%
                      </span>
                    ) : "–"}
                  </p>
                </div>
              </div>

              {/* Chart */}
              {history.length > 1 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Évolution des facings
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar dataKey="Facings" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Référence" fill="#D1D5DB" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* History table */}
              {history.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5" /> Historique mensuel
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-gray-100">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">Mois</th>
                          <th className="px-3 py-2 text-center">Facings</th>
                          <th className="px-3 py-2 text-center">Référence</th>
                          <th className="px-3 py-2 text-center">Évolution</th>
                          <th className="px-3 py-2 text-right">CA Mensuel</th>
                          <th className="px-3 py-2 text-right">CA/Facing</th>
                          {canEditAll && <th className="px-3 py-2 text-center">Modifier</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {[...history].reverse().map((h) => (
                          <tr key={h.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-medium text-gray-700">
                              {formatMois(h.mois)}
                            </td>
                            <td className="px-3 py-2 text-center font-bold text-gray-900">
                              {editingEntryId === h.id ? (
                                <input
                                  type="number"
                                  min="0"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") handleEditEntry(h.id);
                                    if (e.key === "Escape") setEditingEntryId(null);
                                  }}
                                  autoFocus
                                  className="w-16 border border-blue-300 rounded px-2 py-0.5 text-center text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                                />
                              ) : h.nbFacings}
                            </td>
                            <td className="px-3 py-2 text-center text-gray-500">
                              {h.reference ?? "–"}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <EvoBadge value={h.evolution} />
                            </td>
                            <td className="px-3 py-2 text-right text-gray-700">
                              {h.caMensuel > 0
                                ? h.caMensuel.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
                                : "–"}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-blue-700">
                              {h.caParFacing > 0
                                ? h.caParFacing.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
                                : "–"}
                            </td>
                            {canEditAll && (
                              <td className="px-3 py-2 text-center">
                                {editingEntryId === h.id ? (
                                  <button
                                    onClick={() => handleEditEntry(h.id)}
                                    className="text-green-600 hover:text-green-700"
                                  >
                                    <Check className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => { setEditingEntryId(h.id); setEditingValue(String(h.nbFacings)); }}
                                    className="text-gray-300 hover:text-blue-500 transition-colors"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {history.length === 0 && (
                <p className="text-center text-gray-400 py-4 text-sm">
                  Aucun facing enregistré pour ce client.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
