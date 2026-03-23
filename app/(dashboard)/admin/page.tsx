"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import ImportLogs from "@/components/admin/ImportLogs";
import { Users, Plus, Loader2, X, Pencil, RefreshCw, CheckCircle } from "lucide-react";
import UserEditModal from "@/components/admin/UserEditModal";

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  teamType: string | null;
  createdAt: string;
}

const ROLES = [
  "ADMIN",
  "COMMERCIAL_PRINCIPAL",
  "CHEF_TERRAIN",
  "CHEF_TELEVENTE",
  "COMMERCIAL_TERRAIN",
  "COMMERCIAL_TELEVENTE",
  "COMMERCIAL_GRAND_COMPTE",
  "MERCHANDISEUR",
  "AUTRES",
  "DESACTIVE",
];

const TAB_LABELS: Record<string, string> = {
  imports: "Imports Google Drive",
  users: "Utilisateurs",
  categorisation: "Catégorisation",
};

const CATEGORY_COLORS: Record<string, string> = {
  "stratégiques":  "bg-blue-100 text-blue-800",
  "réguliers":     "bg-green-100 text-green-800",
  "occasionnels":  "bg-amber-100 text-amber-800",
  "nouveaux":      "bg-violet-100 text-violet-800",
  "perdus":        "bg-red-100 text-red-800",
  "prospect":      "bg-gray-100 text-gray-500",
};

export default function AdminPage() {
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"imports" | "users" | "categorisation">("imports");
  const [recatLoading, setRecatLoading] = useState(false);
  const [recatResult, setRecatResult] = useState<{ total: number; byCategory: Record<string, number>; prospectsCreated: number } | null>(null);
  const [recatError, setRecatError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "COMMERCIAL_TERRAIN", teamType: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);

  async function fetchData() {
    setLoading(true);
    const [logsRes, usersRes] = await Promise.all([
      fetch("/api/admin/logs"),
      fetch("/api/admin/users"),
    ]);
    const [logsData, usersData] = await Promise.all([logsRes.json(), usersRes.json()]);
    setLogs(logsData);
    setUsers(usersData);
    setLoading(false);
  }

  useEffect(() => { fetchData(); }, []);

  async function handleRecategorize() {
    setRecatLoading(true);
    setRecatError("");
    setRecatResult(null);
    try {
      const res = await fetch("/api/admin/recategorize", { method: "POST" });
      const data = await res.json();
      if (!res.ok) setRecatError(data.error || "Erreur");
      else setRecatResult(data);
    } catch {
      setRecatError("Erreur réseau");
    }
    setRecatLoading(false);
  }

  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Erreur");
    } else {
      setShowModal(false);
      setForm({ name: "", email: "", password: "", role: "COMMERCIAL_TERRAIN", teamType: "" });
      fetchData();
    }
    setSaving(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-[#1E40AF]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-5">
      <Header title="Administration" subtitle="Gestion des imports, utilisateurs et analyses" />

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {(["imports", "users", "categorisation"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? "border-[#1E40AF] text-[#1E40AF]"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {tab === "imports" && (
        <ImportLogs logs={logs} onSync={fetchData} />
      )}

      {tab === "categorisation" && (
        <div className="space-y-5 max-w-2xl">
          {/* Explication des règles */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <h3 className="font-semibold text-gray-800">Règles de catégorisation automatique</h3>
            <p className="text-sm text-gray-500">Les catégories sont calculées à partir des données réelles de ventes, par ordre de priorité :</p>
            <div className="space-y-2 text-sm">
              {[
                { label: "Prospect", color: "bg-gray-100 text-gray-500", rule: "Aucune vente (jamais commandé) → aussi ajouté dans la liste Prospects" },
                { label: "Perdus", color: "bg-red-100 text-red-800", rule: "Dernière commande > 6 mois" },
                { label: "Nouveaux", color: "bg-violet-100 text-violet-800", rule: "Première commande il y a < 3 mois ET encore actif" },
                { label: "Stratégiques", color: "bg-blue-100 text-blue-800", rule: "Top 20% du CA + commande au moins tous les 2 mois" },
                { label: "Réguliers", color: "bg-green-100 text-green-800", rule: "Commande environ toutes les 40 jours (≥ 0,75/mois)" },
                { label: "Occasionnels", color: "bg-amber-100 text-amber-800", rule: "Reste des clients actifs (commande irrégulière)" },
              ].map(({ label, color, rule }) => (
                <div key={label} className="flex items-start gap-3">
                  <span className={`inline-block px-2 py-0.5 text-[10px] font-medium rounded-full whitespace-nowrap flex-shrink-0 mt-0.5 ${color}`}>{label}</span>
                  <span className="text-gray-600">{rule}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Bouton de déclenchement — désactivé temporairement */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 opacity-50 pointer-events-none select-none">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">Lancer la recatégorisation</p>
                <p className="text-xs text-gray-500 mt-0.5">Désactivé — les catégories sont gérées manuellement via import Excel.</p>
              </div>
              <button
                disabled
                className="flex items-center gap-2 px-4 py-2 bg-gray-300 text-gray-500 text-sm rounded-lg cursor-not-allowed"
              >
                <RefreshCw className="w-4 h-4" /> Recatégoriser
              </button>
            </div>
          </div>
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{users.length} utilisateur(s)</p>
            <button
              onClick={() => setShowModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-[#1E40AF] text-white text-sm rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> Ajouter
            </button>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Nom</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Rôle</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Équipe</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-[#1E40AF] text-white rounded-full flex items-center justify-center text-xs font-bold">
                          {u.name.charAt(0)}
                        </div>
                        {u.name}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-xs rounded-full">
                        {u.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{u.teamType || "—"}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="p-1.5 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors"
                        title="Modifier cet utilisateur"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal édition utilisateur */}
      {editingUser && (
        <UserEditModal
          user={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={(updated) => {
            setUsers((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
            setEditingUser(null);
          }}
        />
      )}

      {/* Modal ajout utilisateur */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">Ajouter un utilisateur</h3>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddUser} className="space-y-3">
              <input required placeholder="Nom complet *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input required type="email" placeholder="Email *" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input required type="password" placeholder="Mot de passe *" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
                {ROLES.map((r) => <option key={r} value={r}>{r.replace(/_/g, " ")}</option>)}
              </select>
              <select value={form.teamType} onChange={(e) => setForm({ ...form, teamType: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="">Sans équipe</option>
                <option value="TERRAIN">TERRAIN</option>
                <option value="TELEVENTE">TELEVENTE</option>
              </select>
              {error && <p className="text-xs text-red-600">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50">Annuler</button>
                <button type="submit" disabled={saving}
                  className="flex-1 py-2 bg-[#1E40AF] text-white rounded-lg text-sm hover:bg-blue-700 disabled:opacity-60">
                  {saving ? "Enregistrement..." : "Créer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
