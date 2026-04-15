"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle, XCircle, SkipForward, RefreshCw, RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";

interface ImportLog {
  id: string;
  fileName: string;
  fileDate: string;
  importedAt: string;
  status: "SUCCESS" | "ERROR" | "SKIPPED";
  rowsImported: number;
  errorMessage?: string;
}

const statusConfig = {
  SUCCESS: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Succès" },
  ERROR: { icon: XCircle, color: "text-red-600", bg: "bg-red-50", label: "Erreur" },
  SKIPPED: { icon: SkipForward, color: "text-gray-500", bg: "bg-gray-50", label: "Ignoré" },
};

export default function ImportLogs({ logs, onSync }: { logs: ImportLog[]; onSync: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [confirmRollback, setConfirmRollback] = useState<ImportLog | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [rollbackResult, setRollbackResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/admin/sync", { method: "POST" });
      const data = await res.json();
      setSyncResult(data.message || (data.error ? `Erreur: ${data.error}` : "Terminé"));
      onSync();
    } catch {
      setSyncResult("Erreur de connexion");
    } finally {
      setSyncing(false);
    }
  }

  async function handleRollbackConfirm() {
    if (!confirmRollback) return;
    const log = confirmRollback;
    setConfirmRollback(null);
    setRollingBack(log.id);
    setRollbackResult(null);

    try {
      const res = await fetch(`/api/admin/imports/${log.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setRollbackResult({ type: "error", text: data.error || "Erreur lors de l'annulation" });
      } else {
        setRollbackResult({
          type: "success",
          text: `Import "${log.fileName}" annulé — ${data.ventesDeleted} vente(s) supprimée(s)`,
        });
        onSync();
      }
    } catch {
      setRollbackResult({ type: "error", text: "Erreur réseau" });
    }

    setRollingBack(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Historique des imports</h3>
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-[#1E40AF] text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Synchronisation..." : "Synchroniser maintenant"}
        </button>
      </div>

      {syncResult && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-2 text-sm text-blue-800">
          {syncResult}
        </div>
      )}

      {rollbackResult && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm border ${
          rollbackResult.type === "success"
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {rollbackResult.type === "success"
            ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          {rollbackResult.text}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Fichier</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Date fichier</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Importé le</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Statut</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Lignes</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Message</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-gray-400">
                    Aucun import enregistré
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const cfg = statusConfig[log.status];
                  const Icon = cfg.icon;
                  return (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{log.fileName}</td>
                      <td className="px-4 py-3 text-gray-600">
                        {format(new Date(log.fileDate), "dd/MM/yyyy", { locale: fr })}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {format(new Date(log.importedAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.color}`}
                        >
                          <Icon className="w-3 h-3" />
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">{log.rowsImported}</td>
                      <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                        {log.errorMessage || "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {log.status === "SUCCESS" && log.rowsImported > 0 && (
                          <button
                            onClick={() => setConfirmRollback(log)}
                            disabled={rollingBack !== null}
                            title="Annuler cet import et supprimer ses ventes"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 disabled:opacity-40 whitespace-nowrap"
                          >
                            {rollingBack === log.id
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : <RotateCcw className="w-3 h-3" />}
                            Annuler
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal confirmation rollback */}
      {confirmRollback && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Annuler cet import ?</h3>
                <p className="text-xs text-gray-500 mt-0.5">Les ventes importées seront supprimées</p>
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800 space-y-1">
              <p><strong>Fichier :</strong> {confirmRollback.fileName}</p>
              <p><strong>Importé le :</strong> {format(new Date(confirmRollback.importedAt), "dd/MM/yyyy à HH:mm", { locale: fr })}</p>
              <p><strong>Ventes à supprimer :</strong> {confirmRollback.rowsImported} ligne(s)</p>
            </div>
            <p className="text-sm text-gray-600">
              Le fichier sera retiré de l&apos;historique, ce qui permettra de le <strong>ré-importer</strong> si besoin avec les données corrigées.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmRollback(null)}
                className="flex-1 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
              >
                Annuler
              </button>
              <button
                onClick={handleRollbackConfirm}
                className="flex-1 py-2 bg-orange-600 text-white rounded-lg text-sm hover:bg-orange-700 font-medium"
              >
                Oui, supprimer ces ventes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
