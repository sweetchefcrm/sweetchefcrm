"use client";

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";

interface Commercial {
  id: string;
  name: string;
  role: string;
}

interface Client {
  id: string;
  codeClient: string;
  nom: string;
  codePostal?: string | null;
  telephone?: string | null;
  actif: boolean;
  categorieStatut?: string | null;
  categorieType?: string | null;
  etagere: boolean;
  commercial: { id: string; name: string; role: string };
}

interface ClientEditModalProps {
  client: Client;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (updated: Partial<Client>) => void;
}

const STATUTS = ["stratégiques", "réguliers", "occasionnels", "nouveaux", "perdus", "prospect"];

export default function ClientEditModal({ client, isAdmin, onClose, onSaved }: ClientEditModalProps) {
  const [form, setForm] = useState({
    nom: client.nom,
    codePostal: client.codePostal || "",
    telephone: client.telephone || "",
    categorieStatut: client.categorieStatut || "",
    categorieType: client.categorieType || "",
    actif: client.actif,
    etagere: client.etagere,
    commercialId: client.commercial.id,
  });
  const [commerciaux, setCommerciaux] = useState<Commercial[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAdmin) {
      fetch("/api/admin/users")
        .then((r) => r.json())
        .then((users: Commercial[]) =>
          setCommerciaux(users.filter((u) => u.role !== "ADMIN" && u.role !== "DESACTIVE"))
        );
    }
  }, [isAdmin]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Erreur lors de la sauvegarde");
        return;
      }
      const updated = await res.json();
      onSaved(updated);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Modifier le client</h2>
            <p className="text-xs text-gray-400 font-mono">{client.codeClient}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Nom</label>
              <input
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                required
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code Postal</label>
              <input
                value={form.codePostal}
                onChange={(e) => setForm({ ...form, codePostal: e.target.value })}
                placeholder="ex: 75001"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
              <input
                value={form.telephone}
                onChange={(e) => setForm({ ...form, telephone: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie (statut)</label>
              <select
                value={form.categorieStatut}
                onChange={(e) => setForm({ ...form, categorieStatut: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Non défini —</option>
                {STATUTS.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type métier</label>
              <input
                value={form.categorieType}
                onChange={(e) => setForm({ ...form, categorieType: e.target.value })}
                placeholder="ex: Supermarché, Pharmacie..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {isAdmin && commerciaux.length > 0 && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1">Commercial assigné</label>
                <select
                  value={form.commercialId}
                  onChange={(e) => setForm({ ...form, commercialId: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {commerciaux.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex items-center gap-6 col-span-2">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setForm({ ...form, actif: !form.actif })}
                  className={`w-10 h-5 rounded-full transition-colors ${form.actif ? "bg-green-500" : "bg-gray-300"} relative cursor-pointer`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.actif ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm text-gray-700">Client actif</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div
                  onClick={() => setForm({ ...form, etagere: !form.etagere })}
                  className={`w-10 h-5 rounded-full transition-colors ${form.etagere ? "bg-blue-600" : "bg-gray-300"} relative cursor-pointer`}
                >
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.etagere ? "translate-x-5" : "translate-x-0.5"}`} />
                </div>
                <span className="text-sm text-gray-700">Étagère vendue</span>
              </label>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm font-medium text-white bg-[#1E40AF] rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
