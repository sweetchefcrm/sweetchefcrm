"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Header from "@/components/layout/Header";
import {
  Loader2, Trash2, AlertTriangle, Search, ChevronLeft, ChevronRight, X,
} from "lucide-react";

interface Avoir {
  id: string;
  montant: number;
  dateAvoir: string;
  mois: number;
  annee: number;
  client: { nom: string; codeClient: string };
  commercial: { name: string };
}

interface MoisDispo {
  mois: number;
  annee: number;
}

const MOIS_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

export default function AvoirsPage() {
  const [avoirs, setAvoirs] = useState<Avoir[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [moisDisponibles, setMoisDisponibles] = useState<MoisDispo[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [filterMois, setFilterMois] = useState("");
  const [filterAnnee, setFilterAnnee] = useState("");

  const [confirmDelete, setConfirmDelete] = useState<Avoir | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function fetchAvoirs(p = 1) {
    setLoading(true);
    const params = new URLSearchParams({ page: String(p) });
    if (search) params.set("search", search);
    if (filterMois) params.set("mois", filterMois);
    if (filterAnnee) params.set("annee", filterAnnee);

    try {
      const res = await fetch(`/api/avoirs?${params}`);
      const data = await res.json();
      setAvoirs(data.avoirs ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
      setPage(data.page ?? 1);
      if (data.moisDisponibles) setMoisDisponibles(data.moisDisponibles);
    } catch {
      // ignore
    }
    setLoading(false);
  }

  useEffect(() => { fetchAvoirs(1); }, [search, filterMois, filterAnnee]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleDelete() {
    if (!confirmDelete) return;
    setDeleting(confirmDelete.id);
    setConfirmDelete(null);
    try {
      await fetch(`/api/avoirs/${confirmDelete.id}`, { method: "DELETE" });
      fetchAvoirs(page);
    } catch {
      // ignore
    }
    setDeleting(null);
  }

  // Totaux
  const totalMontant = avoirs.reduce((s, a) => s + Number(a.montant), 0);

  return (
    <div className="p-6 space-y-5">
      <Header
        title="Avoirs"
        subtitle={`${total.toLocaleString("fr-FR")} avoir(s) enregistré(s)`}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 w-60"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <select
          value={filterAnnee}
          onChange={(e) => { setFilterAnnee(e.target.value); setFilterMois(""); }}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
        >
          <option value="">Toutes les années</option>
          {[...new Set(moisDisponibles.map((m) => m.annee))].sort((a, b) => b - a).map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>

        {filterAnnee && (
          <select
            value={filterMois}
            onChange={(e) => setFilterMois(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">Tous les mois</option>
            {moisDisponibles
              .filter((m) => m.annee === parseInt(filterAnnee))
              .sort((a, b) => b.mois - a.mois)
              .map((m) => (
                <option key={m.mois} value={m.mois}>
                  {MOIS_LABELS[m.mois - 1]}
                </option>
              ))}
          </select>
        )}
      </div>

      {/* Summary */}
      {avoirs.length > 0 && (
        <div className="bg-purple-50 border border-purple-200 rounded-xl px-5 py-3 flex items-center justify-between">
          <span className="text-sm text-purple-700 font-medium">
            Total avoirs affichés
          </span>
          <span className="text-lg font-bold text-purple-800">
            -{totalMontant.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
          </span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Client</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Code</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Commercial</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Montant HT</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {avoirs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-400">
                      Aucun avoir trouvé
                    </td>
                  </tr>
                ) : (
                  avoirs.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{a.client.nom}</td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{a.client.codeClient}</td>
                      <td className="px-4 py-3 text-gray-600">{a.commercial.name}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {format(new Date(a.dateAvoir), "dd/MM/yyyy", { locale: fr })}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">
                        -{Number(a.montant).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setConfirmDelete(a)}
                          disabled={deleting === a.id}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                          title="Supprimer cet avoir"
                        >
                          {deleting === a.id
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <Trash2 className="w-4 h-4" />}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm">
              <span className="text-gray-500">
                Page {page} / {pages} — {total.toLocaleString("fr-FR")} avoir(s)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => { setPage(page - 1); fetchAvoirs(page - 1); }}
                  disabled={page <= 1}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => { setPage(page + 1); fetchAvoirs(page + 1); }}
                  disabled={page >= pages}
                  className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal confirmation suppression */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Supprimer cet avoir ?</h3>
                <p className="text-xs text-gray-500 mt-0.5">Cette action est irréversible</p>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800 space-y-1">
              <p><strong>Client :</strong> {confirmDelete.client.nom}</p>
              <p><strong>Date :</strong> {format(new Date(confirmDelete.dateAvoir), "dd/MM/yyyy", { locale: fr })}</p>
              <p><strong>Montant :</strong> -{Number(confirmDelete.montant).toLocaleString("fr-FR", { style: "currency", currency: "EUR" })}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 font-medium"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
