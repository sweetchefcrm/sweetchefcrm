"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import ImportLogs from "@/components/admin/ImportLogs";
import { Users, Plus, Loader2, X, Pencil, RefreshCw, CheckCircle, Save, RotateCcw, AlertTriangle } from "lucide-react";
import UserEditModal from "@/components/admin/UserEditModal";
import AvoirImportSection from "@/components/admin/AvoirImportSection";

interface AvoirImportLog {
  id: string;
  fileName: string;
  importedAt: string;
  status: "SUCCESS" | "ERROR";
  rowsImported: number;
  errorMessage?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  teamType: string | null;
  createdAt: string;
}

interface PlanningRow {
  displayName: string;
  departements: string[];
  belgique: boolean;
  joursDispo: number;
  nbA: number;
  nbB: number;
  nbNouveaux: number;
  nbMerchTV: number;
  nbMerchIlyasse: number;
  joursA: number;
  joursB: number;
  joursNouveaux: number;
  joursMTV: number;
  joursMI: number;
  totalJours: number;
  joursLibres: number;
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
  imports: "Imports factures",
  avoirs: "Imports avoirs",
  users: "Utilisateurs",
  categorisation: "Catégorisation",
  planning: "Planning",
  sauvegardes: "Sauvegardes",
};

const CATEGORY_COLORS: Record<string, string> = {
  "stratégiques":  "bg-blue-100 text-blue-800",
  "réguliers":     "bg-green-100 text-green-800",
  "occasionnels":  "bg-amber-100 text-amber-800",
  "nouveaux":      "bg-violet-100 text-violet-800",
  "perdus":        "bg-red-100 text-red-800",
  "prospect":      "bg-gray-100 text-gray-500",
};

interface BackupMeta {
  id: string;
  createdAt: string;
  clientCount: number;
  venteCount: number;
  label?: string;
}

export default function AdminPage() {
  const [logs, setLogs] = useState([]);
  const [avoirLogs, setAvoirLogs] = useState<AvoirImportLog[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [planning, setPlanning] = useState<PlanningRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"imports" | "avoirs" | "users" | "categorisation" | "planning" | "sauvegardes">("imports");
  const [recatLoading, setRecatLoading] = useState(false);
  const [recatResult, setRecatResult] = useState<{ total: number; byCategory: Record<string, number>; prospectsCreated: number } | null>(null);
  const [recatError, setRecatError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "COMMERCIAL_TERRAIN", teamType: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // --- Sauvegardes ---
  const [backups, setBackups] = useState<BackupMeta[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [backupCreating, setBackupCreating] = useState(false);
  const [restoring, setRestoring] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<BackupMeta | null>(null);
  const [backupMessage, setBackupMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function fetchData() {
    setLoading(true);
    const [logsRes, avoirLogsRes, usersRes, planningRes] = await Promise.all([
      fetch("/api/admin/logs"),
      fetch("/api/admin/avoirs"),
      fetch("/api/admin/users"),
      fetch("/api/planning"),
    ]);
    const [logsData, avoirLogsData, usersData, planningData] = await Promise.all([
      logsRes.json(),
      avoirLogsRes.json(),
      usersRes.json(),
      planningRes.json(),
    ]);
    setLogs(logsData);
    setAvoirLogs(Array.isArray(avoirLogsData) ? avoirLogsData : []);
    setUsers(usersData);
    setPlanning(Array.isArray(planningData) ? planningData : []);
    setLoading(false);
  }

  async function fetchBackups() {
    setBackupsLoading(true);
    try {
      const res = await fetch("/api/admin/backups");
      const data = await res.json();
      setBackups(Array.isArray(data) ? data : []);
    } catch {
      setBackups([]);
    }
    setBackupsLoading(false);
  }

  async function handleCreateBackup() {
    setBackupCreating(true);
    setBackupMessage(null);
    try {
      const res = await fetch("/api/admin/backups", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setBackupMessage({ type: "error", text: data.error || "Erreur lors de la sauvegarde" });
      } else {
        setBackupMessage({ type: "success", text: `Sauvegarde créée : ${data.backup.clientCount} clients, ${data.backup.venteCount} ventes` });
        fetchBackups();
      }
    } catch {
      setBackupMessage({ type: "error", text: "Erreur réseau" });
    }
    setBackupCreating(false);
  }

  async function handleRestoreConfirm() {
    if (!confirmRestore) return;
    setRestoring(confirmRestore.id);
    setConfirmRestore(null);
    setBackupMessage(null);
    try {
      const res = await fetch(`/api/admin/backups/${confirmRestore.id}/restore`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setBackupMessage({ type: "error", text: data.error || "Erreur lors de la restauration" });
      } else {
        setBackupMessage({ type: "success", text: `Restauration réussie : ${data.clientCount} clients, ${data.venteCount} ventes restaurés` });
      }
    } catch {
      setBackupMessage({ type: "error", text: "Erreur réseau" });
    }
    setRestoring(null);
  }

  useEffect(() => { fetchData(); }, []);
  useEffect(() => { if (tab === "sauvegardes") fetchBackups(); }, [tab]);

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
        {(["imports", "avoirs", "users", "categorisation", "planning", "sauvegardes"] as const).map((t) => (
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

      {tab === "avoirs" && (
        <AvoirImportSection logs={avoirLogs} onRefresh={fetchData} />
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

      {tab === "planning" && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                    <th className="text-left px-4 py-3 font-semibold">Commercial</th>
                    <th className="text-center px-3 py-3 font-semibold text-blue-700">Stratégiques<br/><span className="font-normal text-xs">nb</span></th>
                    <th className="text-center px-3 py-3 font-semibold text-blue-700">Stratégiques<br/><span className="font-normal text-xs">jours</span></th>
                    <th className="text-center px-3 py-3 font-semibold text-green-700">Réguliers<br/><span className="font-normal text-xs">nb</span></th>
                    <th className="text-center px-3 py-3 font-semibold text-green-700">Réguliers<br/><span className="font-normal text-xs">jours</span></th>
                    <th className="text-center px-3 py-3 font-semibold text-violet-700">Nouveaux<br/><span className="font-normal text-xs">nb</span></th>
                    <th className="text-center px-3 py-3 font-semibold text-violet-700">Nouveaux<br/><span className="font-normal text-xs">jours</span></th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-500">Merch TV<br/><span className="font-normal text-xs">nb</span></th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-500">Merch TV<br/><span className="font-normal text-xs">jours</span></th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-500">Merch I.<br/><span className="font-normal text-xs">nb</span></th>
                    <th className="text-center px-3 py-3 font-semibold text-gray-500">Merch I.<br/><span className="font-normal text-xs">jours</span></th>
                    <th className="text-center px-3 py-3 font-semibold">Jours<br/><span className="font-normal text-xs">utilisés</span></th>
                    <th className="text-center px-3 py-3 font-semibold">Jours<br/><span className="font-normal text-xs">libres</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {planning.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-8 text-center text-gray-400">
                        Aucune donnée de planning
                      </td>
                    </tr>
                  ) : (
                    planning.map((p) => (
                      <tr key={p.displayName} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{p.displayName}</div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {p.departements.map((d) => (
                              <span key={d} className="px-1.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] rounded font-mono">{d}</span>
                            ))}
                            {p.belgique && (
                              <span className="px-1.5 py-0.5 bg-violet-50 text-violet-600 text-[10px] rounded">BE</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center font-medium text-gray-900">{p.nbA}</td>
                        <td className="px-3 py-3 text-center text-blue-700 font-semibold">{p.joursA}</td>
                        <td className="px-3 py-3 text-center font-medium text-gray-900">{p.nbB}</td>
                        <td className="px-3 py-3 text-center text-green-700 font-semibold">{p.joursB}</td>
                        <td className="px-3 py-3 text-center font-medium text-gray-900">{p.nbNouveaux}</td>
                        <td className="px-3 py-3 text-center text-violet-700 font-semibold">{p.joursNouveaux}</td>
                        <td className="px-3 py-3 text-center font-medium text-gray-500">{p.nbMerchTV}</td>
                        <td className="px-3 py-3 text-center text-gray-500 font-semibold">{p.joursMTV}</td>
                        <td className="px-3 py-3 text-center font-medium text-gray-500">{p.nbMerchIlyasse}</td>
                        <td className="px-3 py-3 text-center text-gray-500 font-semibold">{p.joursMI}</td>
                        <td className="px-3 py-3 text-center font-bold text-gray-900">
                          {p.totalJours}<span className="text-gray-400 font-normal text-xs"> / {p.joursDispo}j</span>
                        </td>
                        <td className={`px-3 py-3 text-center font-bold text-base ${
                          p.joursLibres > 5 ? "text-green-600" : p.joursLibres >= 0 ? "text-orange-500" : "text-red-600"
                        }`}>
                          {p.joursLibres}j
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
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

      {tab === "sauvegardes" && (
        <div className="space-y-4 max-w-3xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-700 font-medium">Sauvegardes automatiques</p>
              <p className="text-xs text-gray-400 mt-0.5">
                Une sauvegarde est créée automatiquement avant chaque import. Vous pouvez aussi en créer une manuellement.
              </p>
            </div>
            <button
              onClick={handleCreateBackup}
              disabled={backupCreating}
              className="flex items-center gap-2 px-4 py-2 bg-[#1E40AF] text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60"
            >
              {backupCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Sauvegarder maintenant
            </button>
          </div>

          {backupMessage && (
            <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm ${
              backupMessage.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}>
              {backupMessage.type === "success"
                ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
              {backupMessage.text}
            </div>
          )}

          {backupsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-[#1E40AF]" />
            </div>
          ) : backups.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400 text-sm">
              Aucune sauvegarde disponible. Lancez un import ou cliquez sur "Sauvegarder maintenant".
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-gray-600">
                    <th className="text-left px-4 py-3 font-semibold">Date</th>
                    <th className="text-left px-4 py-3 font-semibold">Label</th>
                    <th className="text-center px-4 py-3 font-semibold">Clients</th>
                    <th className="text-center px-4 py-3 font-semibold">Ventes</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {backups.map((b) => (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-900 whitespace-nowrap">
                        {new Date(b.createdAt).toLocaleString("fr-FR", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{b.label || "—"}</td>
                      <td className="px-4 py-3 text-center text-gray-700 font-medium">
                        {b.clientCount.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-700 font-medium">
                        {b.venteCount.toLocaleString("fr-FR")}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setConfirmRestore(b)}
                          disabled={restoring !== null}
                          className="flex items-center gap-1.5 ml-auto px-3 py-1.5 text-xs text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 disabled:opacity-50"
                        >
                          {restoring === b.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <RotateCcw className="w-3 h-3" />}
                          Restaurer
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal confirmation restauration */}
      {confirmRestore && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Confirmer la restauration</h3>
                <p className="text-xs text-gray-500 mt-0.5">Cette action est irréversible</p>
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800 space-y-1">
              <p><strong>Sauvegarde :</strong> {new Date(confirmRestore.createdAt).toLocaleString("fr-FR")}</p>
              <p><strong>Contenu :</strong> {confirmRestore.clientCount.toLocaleString("fr-FR")} clients, {confirmRestore.venteCount.toLocaleString("fr-FR")} ventes</p>
              {confirmRestore.label && <p><strong>Label :</strong> {confirmRestore.label}</p>}
            </div>
            <p className="text-sm text-gray-600">
              Toutes les données actuelles (clients et ventes) seront <strong>définitivement supprimées</strong> et remplacées par celles de cette sauvegarde.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRestore(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleRestoreConfirm}
                className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 font-medium"
              >
                Oui, restaurer
              </button>
            </div>
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
