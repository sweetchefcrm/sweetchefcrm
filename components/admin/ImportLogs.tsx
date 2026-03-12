"use client";

import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { CheckCircle, XCircle, SkipForward, RefreshCw } from "lucide-react";
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
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-gray-400">
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
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
