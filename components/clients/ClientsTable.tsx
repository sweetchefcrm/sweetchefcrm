"use client";

import { useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Pencil,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Package,
} from "lucide-react";
import ClientEditModal from "./ClientEditModal";

export interface Client {
  id: string;
  codeClient: string;
  nom: string;
  codePostal?: string | null;
  telephone?: string | null;
  actif: boolean;
  categorieStatut?: string | null;
  categorieType?: string | null;
  etagere: boolean;
  panierMoyen?: number;
  commercial: { id: string; name: string; role: string };
  ventes: { dateVente: string; montant: number }[];
  _count: { ventes: number };
}

interface ClientsTableProps {
  clients: Client[];
  total: number;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  canEdit?: boolean;
  isAdmin?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (field: string) => void;
  onClientUpdated?: (updated: Client) => void;
}

const STATUT_STYLES: Record<string, string> = {
  "stratégiques": "bg-blue-100 text-blue-800",
  "réguliers":    "bg-green-100 text-green-800",
  "occasionnels": "bg-amber-100 text-amber-800",
  "nouveaux":     "bg-violet-100 text-violet-800",
  "perdus":       "bg-red-100 text-red-800",
  "prospect":     "bg-gray-100 text-gray-500",
};

function statutStyle(statut: string): string {
  const lower = statut.toLowerCase();
  for (const [key, cls] of Object.entries(STATUT_STYLES)) {
    if (lower.includes(key)) return cls;
  }
  return "bg-gray-100 text-gray-500";
}

function SortIcon({ field, sortBy, sortOrder }: { field: string; sortBy?: string; sortOrder?: string }) {
  if (sortBy !== field) return <ArrowUpDown className="w-3.5 h-3.5 inline ml-1 text-gray-300" />;
  if (sortOrder === "asc") return <ArrowUp className="w-3.5 h-3.5 inline ml-1 text-blue-600" />;
  return <ArrowDown className="w-3.5 h-3.5 inline ml-1 text-blue-600" />;
}

function SortableTh({
  field,
  label,
  sortBy,
  sortOrder,
  onSort,
  className = "",
}: {
  field: string;
  label: string;
  sortBy?: string;
  sortOrder?: string;
  onSort?: (f: string) => void;
  className?: string;
}) {
  return (
    <th
      className={`text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap cursor-pointer hover:bg-gray-100 select-none ${className}`}
      onClick={() => onSort?.(field)}
    >
      {label}
      <SortIcon field={field} sortBy={sortBy} sortOrder={sortOrder} />
    </th>
  );
}

export default function ClientsTable({
  clients,
  total,
  page,
  totalPages,
  onPageChange,
  canEdit = false,
  isAdmin = false,
  sortBy,
  sortOrder,
  onSort,
  onClientUpdated,
}: ClientsTableProps) {
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  async function handleToggleEtagere(client: Client) {
    if (togglingId) return;
    setTogglingId(client.id);
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ etagere: !client.etagere }),
      });
      if (res.ok) {
        const patch = await res.json();
        onClientUpdated?.({ ...client, ...patch });
      }
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <SortableTh field="codeClient" label="Code" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                <SortableTh field="nom" label="Nom" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                <SortableTh field="categorieStatut" label="Catégorie" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                <SortableTh field="codePostal" label="Code Postal" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
                <th className="text-left px-4 py-3 font-semibold text-gray-600 whitespace-nowrap">Commercial</th>
                <SortableTh field="derniereCommande" label="Dernière cmd" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className="whitespace-nowrap" />
                <SortableTh field="nbCommandes" label="Nb. cmds" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className="text-right" />
                <SortableTh field="panierMoyen" label="Panier moy." sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className="text-right whitespace-nowrap" />
                <SortableTh field="etagere" label="Étagère" sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} className="text-center" />
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Statut</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 12 : 11} className="text-center py-8 text-gray-400">
                    Aucun client trouvé
                  </td>
                </tr>
              ) : (
                clients.map((client) => (
                  <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 whitespace-nowrap">{client.codeClient}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{client.nom}</td>

                    {/* Catégorie = statut fidélité */}
                    <td className="px-4 py-3">
                      {client.categorieStatut ? (
                        <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap ${statutStyle(client.categorieStatut)}`}>
                          {client.categorieStatut}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    {/* Type = type métier */}
                    <td className="px-4 py-3">
                      {client.categorieType ? (
                        <span className="inline-block px-2 py-0.5 text-[10px] font-medium rounded-full bg-slate-100 text-slate-600 whitespace-nowrap">
                          {client.categorieType}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-xs">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-gray-600">{client.codePostal || "—"}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {client.commercial?.role === "ADMIN" ? (
                        <span className="text-gray-400 italic text-xs">À définir</span>
                      ) : (
                        <span className="text-gray-600">{client.commercial?.name || "—"}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {client.ventes[0]
                        ? format(new Date(client.ventes[0].dateVente), "dd MMM yyyy", { locale: fr })
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap tabular-nums">
                      {client._count.ventes}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap tabular-nums">
                      {client._count.ventes > 0 && client.panierMoyen != null
                        ? `${Math.round(client.panierMoyen).toLocaleString("fr-FR")} €`
                        : "—"}
                    </td>

                    {/* Étagère */}
                    <td className="px-4 py-3 text-center">
                      {canEdit ? (
                        <button
                          onClick={() => handleToggleEtagere(client)}
                          disabled={togglingId === client.id}
                          title={client.etagere ? "Étagère vendue — cliquer pour retirer" : "Pas d'étagère — cliquer pour ajouter"}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors ${
                            client.etagere
                              ? "bg-blue-100 text-blue-700 hover:bg-blue-200"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          } ${togglingId === client.id ? "opacity-50 cursor-wait" : "cursor-pointer"}`}
                        >
                          <Package className="w-3 h-3" />
                          {client.etagere ? "Oui" : "Non"}
                        </button>
                      ) : (
                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${client.etagere ? "text-blue-600" : "text-gray-300"}`}>
                          <Package className="w-3 h-3" />
                          {client.etagere ? "Oui" : "Non"}
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {client.actif ? (
                        <CheckCircle className="w-4 h-4 text-green-500 mx-auto" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 mx-auto" />
                      )}
                    </td>

                    {canEdit && (
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => setEditingClient(client)}
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                          title="Modifier ce client"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <span>{total} client(s) au total</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span>{page} / {totalPages || 1}</span>
            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {editingClient && (
        <ClientEditModal
          client={editingClient}
          isAdmin={isAdmin}
          onClose={() => setEditingClient(null)}
          onSaved={(patch) => {
            onClientUpdated?.({ ...editingClient!, ...patch });
            setEditingClient(null);
          }}
        />
      )}
    </>
  );
}
