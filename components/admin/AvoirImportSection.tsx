"use client";

import { useRef, useState } from "react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Upload, CheckCircle, XCircle, RotateCcw, AlertTriangle, Loader2, FileSpreadsheet,
} from "lucide-react";

interface AvoirImportLog {
  id: string;
  fileName: string;
  importedAt: string;
  status: "SUCCESS" | "ERROR";
  rowsImported: number;
  errorMessage?: string;
}

export default function AvoirImportSection({
  logs,
  onRefresh,
}: {
  logs: AvoirImportLog[];
  onRefresh: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [confirmRollback, setConfirmRollback] = useState<AvoirImportLog | null>(null);
  const [rollingBack, setRollingBack] = useState<string | null>(null);
  const [rollbackResult, setRollbackResult] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      setUploadResult({ type: "error", text: "Format invalide — utilisez un fichier .xlsx" });
      return;
    }

    setUploading(true);
    setUploadResult(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/admin/avoirs/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setUploadResult({ type: "error", text: data.error || "Erreur lors de l'import" });
      } else {
        setUploadResult({
          type: "success",
          text: `Import réussi — ${data.imported} avoir(s) importé(s), ${data.skipped} ligne(s) ignorée(s)`,
        });
        onRefresh();
      }
    } catch {
      setUploadResult({ type: "error", text: "Erreur réseau" });
    }

    setUploading(false);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRollbackConfirm() {
    if (!confirmRollback) return;
    const log = confirmRollback;
    setConfirmRollback(null);
    setRollingBack(log.id);
    setRollbackResult(null);

    try {
      const res = await fetch(`/api/admin/avoirs/${log.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        setRollbackResult({ type: "error", text: data.error || "Erreur lors de la suppression" });
      } else {
        setRollbackResult({
          type: "success",
          text: `Import "${log.fileName}" supprimé — ${data.avoirsDeleted} avoir(s) retiré(s)`,
        });
        onRefresh();
      }
    } catch {
      setRollbackResult({ type: "error", text: "Erreur réseau" });
    }

    setRollingBack(null);
  }

  return (
    <div className="space-y-4">
      {/* Header + upload */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Imports avoirs</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Colonnes attendues : <span className="font-mono">Code Client, Total HT, Date Avoir, Vendeur</span>
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileUpload}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-60 transition-colors"
          >
            {uploading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {uploading ? "Import en cours..." : "Importer un fichier avoirs"}
          </button>
        </div>
      </div>

      {/* Résultat upload */}
      {uploadResult && (
        <div className={`flex items-start gap-2 px-4 py-3 rounded-lg text-sm border ${
          uploadResult.type === "success"
            ? "bg-green-50 border-green-200 text-green-700"
            : "bg-red-50 border-red-200 text-red-700"
        }`}>
          {uploadResult.type === "success"
            ? <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            : <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
          {uploadResult.text}
        </div>
      )}

      {/* Résultat rollback */}
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

      {/* Table des imports */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-purple-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Fichier</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Importé le</th>
                <th className="text-center px-4 py-3 font-semibold text-gray-600">Statut</th>
                <th className="text-right px-4 py-3 font-semibold text-gray-600">Avoirs</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    <FileSpreadsheet className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    Aucun import d&apos;avoirs — importez un fichier .xlsx
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{log.fileName}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {format(new Date(log.importedAt), "dd/MM/yyyy HH:mm", { locale: fr })}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {log.status === "SUCCESS" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-600">
                          <CheckCircle className="w-3 h-3" /> Succès
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-600">
                          <XCircle className="w-3 h-3" /> Erreur
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-purple-700">
                      {log.rowsImported}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {log.status === "SUCCESS" && log.rowsImported > 0 && (
                        <button
                          onClick={() => setConfirmRollback(log)}
                          disabled={rollingBack !== null}
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
                ))
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
                <h3 className="font-semibold text-gray-900">Annuler cet import avoirs ?</h3>
                <p className="text-xs text-gray-500 mt-0.5">Tous les avoirs de ce fichier seront supprimés</p>
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-sm text-orange-800 space-y-1">
              <p><strong>Fichier :</strong> {confirmRollback.fileName}</p>
              <p><strong>Importé le :</strong> {format(new Date(confirmRollback.importedAt), "dd/MM/yyyy à HH:mm", { locale: fr })}</p>
              <p><strong>Avoirs à supprimer :</strong> {confirmRollback.rowsImported} ligne(s)</p>
            </div>
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
                Oui, supprimer ces avoirs
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
