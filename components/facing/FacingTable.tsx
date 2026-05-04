"use client";

import { useState } from "react";
import { Info, TrendingUp, TrendingDown, Minus, PlusCircle } from "lucide-react";
import FacingModal from "./FacingModal";

export type ClientFacing = {
  id: string;
  nom: string;
  codeClient: string;
  categorieType: string | null;
  categorieStatut: string | null;
  commercial: { id: string; name: string };
  facingActuel: { nbFacings: number; mois: string } | null;
  facingReference: { nbFacings: number; mois: string } | null;
  evolution: number | null;
  caMensuel: number;
  caParFacing: number | null;
};

type SortKey = "nom" | "commercial" | "facingActuel" | "evolution" | "caMensuel" | "caParFacing";

function EvolutionBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-300">–</span>;
  if (value > 0)
    return (
      <span className="inline-flex items-center gap-1 text-green-600 font-semibold text-xs">
        <TrendingUp className="w-3.5 h-3.5" />+{value}%
      </span>
    );
  if (value < 0)
    return (
      <span className="inline-flex items-center gap-1 text-red-500 font-semibold text-xs">
        <TrendingDown className="w-3.5 h-3.5" />{value}%
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-gray-400 text-xs">
      <Minus className="w-3.5 h-3.5" />0%
    </span>
  );
}

export default function FacingTable({
  clients,
  canEdit,
  canEditAll,
  selectedMois,
  onRefresh,
}: {
  clients: ClientFacing[];
  canEdit: boolean;
  canEditAll: boolean;
  selectedMois: string;
  onRefresh: () => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("nom");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [modalClientId, setModalClientId] = useState<string | null>(null);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  }

  const sorted = [...clients].sort((a, b) => {
    let vA: number | string = 0;
    let vB: number | string = 0;
    if (sortKey === "nom") { vA = a.nom; vB = b.nom; }
    else if (sortKey === "commercial") { vA = a.commercial.name; vB = b.commercial.name; }
    else if (sortKey === "facingActuel") { vA = a.facingActuel?.nbFacings ?? -1; vB = b.facingActuel?.nbFacings ?? -1; }
    else if (sortKey === "evolution") { vA = a.evolution ?? -9999; vB = b.evolution ?? -9999; }
    else if (sortKey === "caMensuel") { vA = a.caMensuel; vB = b.caMensuel; }
    else if (sortKey === "caParFacing") { vA = a.caParFacing ?? -1; vB = b.caParFacing ?? -1; }

    if (typeof vA === "string" && typeof vB === "string") {
      return sortDir === "asc" ? vA.localeCompare(vB) : vB.localeCompare(vA);
    }
    return sortDir === "asc" ? (vA as number) - (vB as number) : (vB as number) - (vA as number);
  });

  function SortIcon({ col }: { col: SortKey }) {
    if (sortKey !== col) return <span className="text-gray-300 ml-1">↕</span>;
    return <span className="text-blue-600 ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>;
  }

  const modalClient = clients.find((c) => c.id === modalClientId) ?? null;

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort("nom")}>
                Client <SortIcon col="nom" />
              </th>
              <th className="px-4 py-3 text-left cursor-pointer select-none" onClick={() => handleSort("commercial")}>
                Commercial <SortIcon col="commercial" />
              </th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-center cursor-pointer select-none" onClick={() => handleSort("facingActuel")}>
                Facing actuel <SortIcon col="facingActuel" />
              </th>
              <th className="px-4 py-3 text-center">Référence</th>
              <th className="px-4 py-3 text-center cursor-pointer select-none" onClick={() => handleSort("evolution")}>
                Évolution <SortIcon col="evolution" />
              </th>
              <th className="px-4 py-3 text-right cursor-pointer select-none" onClick={() => handleSort("caMensuel")}>
                CA Mensuel <SortIcon col="caMensuel" />
              </th>
              <th className="px-4 py-3 text-right cursor-pointer select-none" onClick={() => handleSort("caParFacing")}>
                CA/Facing <SortIcon col="caParFacing" />
              </th>
              <th className="px-4 py-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sorted.map((client) => (
              <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-900">{client.nom}</div>
                  <div className="text-xs text-gray-400">{client.codeClient}</div>
                </td>
                <td className="px-4 py-3 text-gray-600 text-sm">{client.commercial.name}</td>
                <td className="px-4 py-3">
                  {client.categorieType ? (
                    <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-50 text-blue-700 font-medium">
                      {client.categorieType}
                    </span>
                  ) : (
                    <span className="text-gray-300">–</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {client.facingActuel ? (
                    <span className="font-bold text-gray-900 text-base">
                      {client.facingActuel.nbFacings}
                    </span>
                  ) : (
                    <span className="text-gray-300 text-xs">non saisi</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-gray-500">
                  {client.facingReference?.nbFacings ?? <span className="text-gray-300">–</span>}
                </td>
                <td className="px-4 py-3 text-center">
                  <EvolutionBadge value={client.evolution} />
                </td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">
                  {client.caMensuel > 0
                    ? client.caMensuel.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
                    : <span className="text-gray-300">–</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  {client.caParFacing !== null ? (
                    <span className="font-semibold text-blue-700">
                      {client.caParFacing.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })}
                    </span>
                  ) : (
                    <span className="text-gray-300">–</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {/* Bouton ajouter/modifier facing */}
                    {canEdit && (
                      <button
                        onClick={() => setModalClientId(client.id)}
                        className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg transition-colors"
                        title="Saisir le facing"
                      >
                        <PlusCircle className="w-3.5 h-3.5" />
                        Saisir
                      </button>
                    )}
                    {/* Bouton historique */}
                    <button
                      onClick={() => setModalClientId(client.id)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Voir l'historique"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-10 text-gray-400">
                  Aucun client trouvé
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {modalClient && (
        <FacingModal
          client={modalClient}
          canEdit={canEdit}
          canEditAll={canEditAll}
          selectedMois={selectedMois}
          onClose={() => setModalClientId(null)}
          onSaved={() => { setModalClientId(null); onRefresh(); }}
        />
      )}
    </>
  );
}
