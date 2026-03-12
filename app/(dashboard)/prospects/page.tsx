"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Plus, Search, CheckCircle, Clock, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface Prospect {
  id: string;
  nom: string;
  ville?: string;
  telephone?: string;
  email?: string;
  converti: boolean;
  createdAt: string;
}

export default function ProspectsPage() {
  const [data, setData] = useState<{ prospects: Prospect[]; total: number; totalPages: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ nom: "", ville: "", telephone: "", email: "" });
  const [saving, setSaving] = useState(false);

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, page: String(page) });
    const res = await fetch(`/api/prospects?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [search, page]);

  useEffect(() => {
    const t = setTimeout(fetchProspects, 300);
    return () => clearTimeout(t);
  }, [fetchProspects]);

  async function handleAddProspect(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setShowModal(false);
    setForm({ nom: "", ville: "", telephone: "", email: "" });
    fetchProspects();
  }

  return (
    <div className="p-6 space-y-5">
      <Header title="Prospects" subtitle="Suivi et conversion des prospects" />

      <div className="flex items-center justify-between gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#1E40AF] text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" /> Ajouter
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-[#1E40AF]" />
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nom</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Ville</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Téléphone</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Ajouté le</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.prospects || []).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">Aucun prospect</td>
                  </tr>
                ) : (
                  (data?.prospects || []).map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{p.nom}</td>
                      <td className="px-4 py-3 text-gray-600">{p.ville || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{p.telephone || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{p.email || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {format(new Date(p.createdAt), "dd MMM yyyy", { locale: fr })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {p.converti ? (
                          <span className="inline-flex items-center gap-1 text-green-600 text-xs font-medium">
                            <CheckCircle className="w-3.5 h-3.5" /> Converti
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-orange-500 text-xs font-medium">
                            <Clock className="w-3.5 h-3.5" /> En cours
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
            <span>{data?.total || 0} prospect(s)</span>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span>{page} / {data?.totalPages || 1}</span>
              <button onClick={() => setPage(p => p + 1)} disabled={page >= (data?.totalPages || 1)} className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-base font-semibold mb-4">Ajouter un prospect</h3>
            <form onSubmit={handleAddProspect} className="space-y-4">
              <input required placeholder="Nom *" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="Ville" value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input placeholder="Téléphone" value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-[#1E40AF] text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                  {saving ? "Enregistrement..." : "Ajouter"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
