"use client";

import { useState, useRef } from "react";
import { Pencil, Check, X, Info } from "lucide-react";
import MetrageModal from "./MetrageModal";

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

type SortKey = "nom" | "lineaire" | "caAnnuel" | "caMetre";

export default function MetrageTable({
  clients,
  canEdit,
  onMetrageUpdate,
}: {
  clients: ClientMetrage[];
  canEdit: boolean;
  onMetrageUpdate: (id: string, lineaire: number | null) => Promise<void>;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("nom");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const [modalClient, setModalClient] = useState<ClientMetrage | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function startEdit(client: ClientMetrage) {
    setEditingId(client.id);
    setEditValue(client.lineaire !== null && client.lineaire !== undefined ? String(client.lineaire) : "");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  async function saveEdit(client: ClientMetrage) {
    const val = editValue.trim() === "" ? null : parseFloat(editValue.replace(",", "."));
    if (val !== null && (isNaN(val) || val < 0)) {
      setEditingId(null);
      return;
    }
    await onMetrageUpdate(client.id, val);
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
  }

  const sorted = [...clients].sort((a, b) => {
    let valA: number | string | null = null;
    let valB: number | string | null = null;
    if (sortKey === "nom") { valA = a.nom; valB = b.nom; }
    else if (sortKey === "lineaire") { valA = a.lineaire ?? -1; valB = b.lineaire ?? -1; }
    else if (sortKey === "caAnnuel") { valA = a.caAnnuel; valB = b.caAnnuel; }
    else if (sortKey === "caMetre") { valA = a.caMetre ?? -1; valB = b.caMetre ?? -1; }

    if (typeof valA === "string" && typeof valB === "string") {
      return sortDir === "asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    const nA = (valA as number) ?? 0;
    const nB = (valB as number) ?? 0;
    return sortDir === "asc" ? nA - nB : nB - nA;
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort("nom")}>
                Client <SortIcon col="nom" />
              </th>
              <th className="px-4 py-3 text-left">Commercial</th>
              <th className="px-4 py-3 text-center cursor-pointer select-none" onClick={() => handleSort("lineaire")}>
                Métrage (m) <SortIcon col="lineaire" />
              </th>
              <th className="px-4 py-3 text-right cursor-pointer select-none" onClick={() => handleSort("caAnnuel")}>
                CA Annuel <SortIcon col="caAnnuel" />
              </th>
              <th className="px-4 py-3 text-right cursor-pointer select-none" onClick={() => handleSort("caMetre")}>
                CA/m <SortIcon col="caMetre" />
              </th>
              <th className="px-4 py-3 text-center">Détail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((client) => (
              <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{client.nom}</div>
                  <div className="text-xs text-gray-400">{client.codeClient}</div>
                </td>
                <td className="px-4 py-3 text-gray-600">{client.commercial.name}</td>
                <td className="px-4 py-3 text-center">
                  {editingId === client.id ? (
                    <div className="flex items-center justify-center gap-1">
                      <input
                        ref={inputRef}
                        type="number"
                        min="0"
                        step="0.1"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit(client);
                          if (e.key === "Escape") cancelEdit();
                        }}
                        className="w-20 border border-blue-300 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
                      />
                      <button onClick={() => saveEdit(client)} className="text-green-600 hover:text-green-700">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={cancelEdit} className="text-gray-400 hover:text-gray-600">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center gap-2">
                      <span className={client.lineaire !== null && client.lineaire !== undefined ? "font-medium text-gray-800" : "text-gray-300"}>
                        {client.lineaire !== null && client.lineaire !== undefined ? `${client.lineaire} m` : "–"}
                      </span>
                      {canEdit && (
                        <button
                          onClick={() => startEdit(client)}
                          className="text-gray-300 hover:text-blue-500 transition-colors"
                          title="Modifier le métrage"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">
                  {client.caAnnuel > 0
                    ? client.caAnnuel.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
                    : <span className="text-gray-300">–</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {client.caMetre !== null ? (
                    <span className="font-semibold text-blue-700">
                      {client.caMetre.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                    </span>
                  ) : (
                    <span className="text-gray-300">–</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => setModalClient(client)}
                    className="text-gray-400 hover:text-blue-600 transition-colors"
                    title="Voir le détail"
                  >
                    <Info className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-10 text-gray-400">
                  Aucun client trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalClient && (
        <MetrageModal
          client={modalClient}
          canEdit={canEdit}
          onClose={() => setModalClient(null)}
          onMetrageUpdate={async (id, lineaire) => {
            await onMetrageUpdate(id, lineaire);
            setModalClient(null);
          }}
        />
      )}
    </>
  );
}
