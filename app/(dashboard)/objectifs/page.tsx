"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import {
  Target,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle,
  XCircle,
  TrendingUp,
  TrendingDown,
  Minus,
  Save,
  Sparkles,
  MapPin,
  Phone,
  AlertTriangle,
  X,
  Euro,
  CalendarDays,
  Crosshair,
} from "lucide-react";
import { useSession } from "next-auth/react";
import { Role } from "@prisma/client";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine,
} from "recharts";

// ─── Types ──────────────────────────────────────────────────────────────────

interface Recommandation {
  montant: number;
  raisonnement: string;
  confiance: "haute" | "moyenne" | "faible";
}

interface HistoPoint { mois: number; annee: number; ca: number }

interface CommercialObjectif {
  user: { id: string; name: string; role: string; teamType: string | null };
  caMois: number;
  caPrev: number;
  caN1: number;
  variation: number | null;
  objectif: { id: string; montantCible: number; tauxCroissance: number | null } | null;
  objectifPrevAtteint: boolean | null;
  recommandation: Recommandation;
  histo: HistoPoint[];
}

interface GlobalHisto {
  mois: number; annee: number; label: string;
  ca: number; caN1: number;
}

interface GlobalStats {
  caTotal: number; caPrev: number; caN1: number;
  variationPrev: number | null; variationN1: number | null;
  prediction: number;
  histo: GlobalHisto[];
}

interface ApiData {
  commerciaux: CommercialObjectif[];
  mois: number;
  annee: number;
  global: GlobalStats;
}

// Données détaillées chargées à l'ouverture du panel
interface CommercialDetail {
  stats: {
    caMois: number; caPrev: number; variation: number;
    clientsActifs: number; totalClients: number;
    nbCommandesMois: number; nbSansCommande: number;
  };
  evolutionTousMois: { mois: number; annee: number; ca: number }[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MOIS_NOMS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];

function formatEur(n: number) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: "EUR", maximumFractionDigits: 0,
  }).format(n);
}

function daysInMonth(m: number, y: number) {
  return new Date(y, m, 0).getDate();
}

function joursEcoules(mois: number, annee: number): number {
  const now = new Date();
  if (annee > now.getFullYear() || (annee === now.getFullYear() && mois > now.getMonth() + 1)) return 0;
  if (annee === now.getFullYear() && mois === now.getMonth() + 1) return now.getDate();
  return daysInMonth(mois, annee);
}

function variationColor(v: number | null) {
  if (v === null) return "text-gray-400";
  if (v > 0) return "text-green-600";
  if (v < 0) return "text-red-500";
  return "text-gray-500";
}

function variationIcon(v: number | null) {
  if (v === null || Math.abs(v) < 1) return <Minus className="w-3.5 h-3.5" />;
  if (v > 0) return <TrendingUp className="w-3.5 h-3.5" />;
  return <TrendingDown className="w-3.5 h-3.5" />;
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function TeamBadge({ teamType }: { teamType: string | null }) {
  if (!teamType) return null;
  const isTerrain = teamType === "TERRAIN";
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
      isTerrain ? "bg-emerald-100 text-emerald-700" : "bg-violet-100 text-violet-700"
    }`}>
      {isTerrain ? <MapPin className="w-2.5 h-2.5" /> : <Phone className="w-2.5 h-2.5" />}
      {isTerrain ? "Terrain" : "Télévente"}
    </span>
  );
}

function KPIStat({
  label, value, sub, icon: Icon, color = "blue", small = false,
}: {
  label: string; value: string; sub?: string;
  icon: React.ElementType; color?: "blue" | "green" | "red" | "amber" | "gray";
  small?: boolean;
}) {
  const colors = {
    blue:  "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    red:   "bg-red-50 text-red-500",
    amber: "bg-amber-50 text-amber-600",
    gray:  "bg-gray-100 text-gray-500",
  };
  return (
    <div className={`bg-white rounded-xl border border-gray-200 ${small ? "p-3" : "p-4"}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`p-1.5 rounded-lg ${colors[color]}`}>
          <Icon className="w-3.5 h-3.5" />
        </span>
        <span className="text-xs text-gray-500 font-medium">{label}</span>
      </div>
      <p className={`font-bold text-gray-900 ${small ? "text-base" : "text-lg"}`}>{value}</p>
      {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Graphique global ────────────────────────────────────────────────────────

function GlobalChart({ histo, prediction, mois, annee }: {
  histo: GlobalHisto[]; prediction: number; mois: number; annee: number;
}) {
  const hasN1 = histo.some((h) => h.caN1 > 0);
  const chartData = histo.map((h) => {
    const isCurrent = h.mois === mois && h.annee === annee;
    return {
      label: h.label,
      ca: h.ca || null,
      caN1: h.caN1 || null,
      prevision: isCurrent && prediction > 0 ? prediction : null,
    };
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-800">Évolution CA — 12 derniers mois</h3>
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-[#1E40AF] inline-block" /> CA réel</span>
          {hasN1 && <span className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dashed border-gray-400 inline-block" /> N-1</span>}
          {prediction > 0 && <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-400 inline-block opacity-70" /> Prévision</span>}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={chartData} margin={{ top: 4, right: 10, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} />
          <YAxis
            tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}k€`}
          />
          <Tooltip
            formatter={(value: unknown, name: unknown) => [
              typeof value === "number" ? formatEur(value) : "—",
              name === "ca" ? "CA réel" : name === "caN1" ? "CA N-1" : "Prévision",
            ]}
          />
          <Bar dataKey="ca" fill="#1E40AF" radius={[3, 3, 0, 0]} maxBarSize={40} />
          <Bar dataKey="prevision" fill="#F59E0B" radius={[3, 3, 0, 0]} maxBarSize={40} opacity={0.65} />
          {hasN1 && (
            <Line type="monotone" dataKey="caN1" stroke="#9CA3AF" strokeWidth={1.5} strokeDasharray="5 3" dot={false} />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Carte commercial ────────────────────────────────────────────────────────

function CommercialCard({
  c, mois, annee, onClick, isSelected,
}: {
  c: CommercialObjectif; mois: number; annee: number;
  onClick: () => void; isSelected: boolean;
}) {
  const jours = joursEcoules(mois, annee);
  const joursTotaux = daysInMonth(mois, annee);
  const caJour = jours > 0 ? c.caMois / jours : 0;
  const projection = caJour * joursTotaux;
  const objectifMontant = c.objectif?.montantCible ?? 0;
  const pctObjectif = objectifMontant > 0 ? Math.min((c.caMois / objectifMontant) * 100, 100) : 0;
  const atteint = objectifMontant > 0 && c.caMois >= objectifMontant;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left bg-white rounded-xl border transition-all p-4 space-y-3 hover:shadow-md ${
        isSelected
          ? "border-[#1E40AF] ring-2 ring-blue-200 shadow-md"
          : "border-gray-200 hover:border-blue-300"
      }`}
    >
      {/* Nom + équipe */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{c.user.name}</p>
          <div className="mt-0.5"><TeamBadge teamType={c.user.teamType} /></div>
        </div>
        {c.objectifPrevAtteint !== null && (
          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
            c.objectifPrevAtteint ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
          }`}>
            {c.objectifPrevAtteint ? "✓ Obj préc." : "✗ Obj préc."}
          </span>
        )}
      </div>

      {/* CA mois */}
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide">CA réalisé</p>
          <p className="text-base font-bold text-gray-900">{formatEur(c.caMois)}</p>
        </div>
        {c.variation !== null && (
          <span className={`flex items-center gap-0.5 text-xs font-semibold ${variationColor(c.variation)}`}>
            {variationIcon(c.variation)}
            {c.variation > 0 ? "+" : ""}{c.variation.toFixed(1)}%
          </span>
        )}
      </div>

      {/* Objectif + barre */}
      {objectifMontant > 0 ? (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-gray-500">
            <span>Objectif : <strong className="text-gray-800">{formatEur(objectifMontant)}</strong></span>
            <span className={atteint ? "text-green-600 font-semibold" : "text-gray-600"}>
              {atteint ? "Atteint ✓" : `${Math.round(pctObjectif)}%`}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                atteint ? "bg-green-500" : pctObjectif >= 70 ? "bg-blue-500" : pctObjectif >= 40 ? "bg-amber-400" : "bg-red-400"
              }`}
              style={{ width: `${pctObjectif}%` }}
            />
          </div>
        </div>
      ) : (
        <p className="text-[10px] text-gray-400 italic">Objectif non défini</p>
      )}

      {/* Journalier + projection */}
      <div className="flex gap-3 pt-1 border-t border-gray-100">
        <div className="flex-1">
          <p className="text-[10px] text-gray-400">Moy./jour</p>
          <p className="text-xs font-semibold text-gray-700">{formatEur(Math.round(caJour))}</p>
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-gray-400">Projection</p>
          <p className={`text-xs font-semibold ${
            objectifMontant > 0
              ? projection >= objectifMontant ? "text-green-600" : "text-amber-600"
              : "text-gray-700"
          }`}>
            {formatEur(Math.round(projection))}
          </p>
        </div>
        <div className="flex-1">
          <p className="text-[10px] text-gray-400">N-1</p>
          <p className="text-xs font-semibold text-gray-600">
            {c.caN1 > 0 ? formatEur(c.caN1) : "—"}
          </p>
        </div>
      </div>
    </button>
  );
}

// ─── Calendrier mensuel ───────────────────────────────────────────────────────

function CalendrierHistorique({
  evolution, moisActuel, anneeActuelle,
}: {
  evolution: { mois: number; annee: number; ca: number }[];
  moisActuel: number;
  anneeActuelle: number;
}) {
  if (evolution.length === 0) {
    return (
      <div className="text-center text-sm text-gray-400 py-4">Aucune donnée disponible.</div>
    );
  }

  // On regroupe par année
  const parAnnee = new Map<number, Map<number, number>>();
  for (const e of evolution) {
    if (!parAnnee.has(e.annee)) parAnnee.set(e.annee, new Map());
    parAnnee.get(e.annee)!.set(e.mois, e.ca);
  }

  // On trie les années décroissantes
  const annees = [...parAnnee.keys()].sort((a, b) => b - a);

  // Calcul de la moyenne pour coloration
  const valeurs = evolution.map((e) => e.ca).filter((v) => v > 0);
  const moyenne = valeurs.length > 0 ? valeurs.reduce((a, b) => a + b, 0) / valeurs.length : 0;

  function cellColor(ca: number, isCurrentMonth: boolean): string {
    if (isCurrentMonth && ca === 0) return "bg-blue-50 border-blue-300 text-blue-400";
    if (ca === 0) return "bg-gray-50 text-gray-300";
    if (ca >= moyenne * 1.2) return "bg-green-100 text-green-800 border-green-200";
    if (ca >= moyenne * 0.8) return "bg-blue-50 text-blue-800 border-blue-100";
    return "bg-red-50 text-red-700 border-red-100";
  }

  return (
    <div className="space-y-4">
      {annees.map((annee) => {
        const moisMap = parAnnee.get(annee)!;
        return (
          <div key={annee}>
            <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-2">{annee}</p>
            <div className="grid grid-cols-4 gap-1.5">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
                const ca = moisMap.get(m) ?? 0;
                const isCurrentMonth = m === moisActuel && annee === anneeActuelle;
                const isFutur = annee > anneeActuelle || (annee === anneeActuelle && m > moisActuel);
                if (isFutur) {
                  return (
                    <div key={m} className="border border-dashed border-gray-200 rounded-lg p-2 text-center opacity-40">
                      <p className="text-[9px] text-gray-400">{MOIS_COURTS[m - 1]}</p>
                      <p className="text-[10px] text-gray-300">—</p>
                    </div>
                  );
                }
                return (
                  <div
                    key={m}
                    className={`border rounded-lg p-2 text-center transition-all ${cellColor(ca, isCurrentMonth)} ${
                      isCurrentMonth ? "ring-2 ring-[#1E40AF] ring-offset-1" : ""
                    }`}
                  >
                    <p className="text-[9px] font-semibold opacity-70">{MOIS_COURTS[m - 1]}</p>
                    {ca > 0 ? (
                      <p className="text-[10px] font-bold leading-tight mt-0.5">
                        {ca >= 1000 ? `${(ca / 1000).toFixed(1)}k` : `${Math.round(ca)}`}
                      </p>
                    ) : (
                      <p className="text-[10px] opacity-40 leading-tight mt-0.5">0</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {/* Légende */}
      <div className="flex flex-wrap gap-3 text-[10px] text-gray-500 pt-1 border-t border-gray-100">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-200 inline-block" /> Au-dessus moy. (+20%)</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-100 inline-block" /> Dans la moyenne</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-100 inline-block" /> En-dessous moy.</span>
      </div>
    </div>
  );
}

// ─── Panneau latéral détail ───────────────────────────────────────────────────

function CommercialPanel({
  c, mois, annee, onClose, onSaved,
}: {
  c: CommercialObjectif; mois: number; annee: number;
  onClose: () => void; onSaved: (commercialId: string, montant: number) => void;
}) {
  const [inputVal, setInputVal] = useState(
    c.objectif ? String(Math.round(c.objectif.montantCible)) : ""
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState("");

  // Données détaillées chargées à l'ouverture
  const [detail, setDetail] = useState<CommercialDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);

  useEffect(() => {
    setDetailLoading(true);
    fetch(`/api/commercial/${c.user.id}?mois=${mois}&annee=${annee}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }, [c.user.id, mois, annee]);

  const jours = joursEcoules(mois, annee);
  const joursTotaux = daysInMonth(mois, annee);
  const joursRestants = joursTotaux - jours;
  const caJour = jours > 0 ? c.caMois / jours : 0;
  const projection = caJour * joursTotaux;
  const objectifMontant = c.objectif?.montantCible ?? 0;
  const pctObjectif = objectifMontant > 0 ? Math.min((c.caMois / objectifMontant) * 100, 100) : 0;
  const atteint = objectifMontant > 0 && c.caMois >= objectifMontant;

  const moisPrevLabel = mois === 1 ? `Déc. ${annee - 1}` : `${MOIS_NOMS[mois - 2].slice(0, 4)}.`;

  // Graphique historique — on prend les 12 derniers mois de evolutionTousMois
  const chartData = (detail?.evolutionTousMois ?? []).slice(-12).map((e) => ({
    label: `${MOIS_COURTS[e.mois - 1]}${e.annee !== annee ? ` ${e.annee}` : ""}`,
    ca: e.ca,
    isCurrent: e.mois === mois && e.annee === annee,
  }));
  const caMax = Math.max(...chartData.map((d) => d.ca), objectifMontant, 1);

  async function handleSave() {
    const montant = parseFloat(inputVal.replace(/\s/g, "").replace(",", "."));
    if (isNaN(montant) || montant <= 0) { setErr("Montant invalide"); return; }
    setSaving(true);
    setErr("");
    try {
      const res = await fetch("/api/admin/objectifs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ commercialId: c.user.id, mois, annee, montantCible: montant }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      onSaved(c.user.id, montant);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setErr("Erreur de sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/20 backdrop-blur-sm" onClick={onClose} />
      <div className="w-[560px] flex-shrink-0 bg-white shadow-2xl border-l border-gray-200 h-full flex flex-col overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex items-start justify-between flex-shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-gray-900 text-base">{c.user.name}</h2>
              <TeamBadge teamType={c.user.teamType} />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {MOIS_NOMS[mois - 1]} {annee} · {jours} jour{jours > 1 ? "s" : ""} écoulé{jours > 1 ? "s" : ""} sur {joursTotaux}
              {joursRestants > 0 && ` · ${joursRestants}j restants`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 mt-0.5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corps scrollable */}
        <div className="flex-1 overflow-y-auto">
          {detailLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-7 h-7 animate-spin text-[#1E40AF]" />
            </div>
          ) : (
            <div className="p-6 space-y-6">

              {/* ── KPIs ─────────────────────────────────── */}
              <div className="grid grid-cols-2 gap-3">
                <KPIStat
                  label="CA réalisé"
                  value={formatEur(c.caMois)}
                  sub={c.caPrev > 0 ? `vs ${moisPrevLabel} : ${formatEur(c.caPrev)}` : undefined}
                  icon={Euro}
                  color={c.caMois > 0 && c.caMois >= c.caPrev ? "green" : c.caMois > 0 ? "red" : "gray"}
                  small
                />
                <KPIStat
                  label="Objectif mensuel"
                  value={objectifMontant > 0 ? formatEur(objectifMontant) : "Non défini"}
                  sub={objectifMontant > 0 ? (atteint ? "Atteint ✓" : `${Math.round(pctObjectif)}% atteint`) : "À définir ci-dessous"}
                  icon={Target}
                  color={atteint ? "green" : objectifMontant > 0 ? "blue" : "gray"}
                  small
                />
                <KPIStat
                  label="Moy. journalière"
                  value={`${formatEur(Math.round(caJour))}/j`}
                  sub={`Base : ${jours} jour${jours > 1 ? "s" : ""} écoulé${jours > 1 ? "s" : ""}`}
                  icon={CalendarDays}
                  color="amber"
                  small
                />
                <KPIStat
                  label="Projection fin mois"
                  value={formatEur(Math.round(projection))}
                  sub={
                    objectifMontant > 0
                      ? projection >= objectifMontant
                        ? `+${formatEur(Math.round(projection - objectifMontant))} sur l'objectif`
                        : `Manque ${formatEur(Math.round(objectifMontant - projection))}`
                      : `${joursTotaux} jours au total`
                  }
                  icon={Crosshair}
                  color={objectifMontant > 0 ? (projection >= objectifMontant ? "green" : "red") : "blue"}
                  small
                />
              </div>

              {/* Stats clients */}
              {detail?.stats && (
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Clients actifs", value: detail.stats.clientsActifs, total: detail.stats.totalClients },
                    { label: "Ont commandé", value: detail.stats.nbCommandesMois, total: detail.stats.totalClients },
                    { label: "Sans commande", value: detail.stats.nbSansCommande, total: detail.stats.totalClients },
                  ].map((s) => (
                    <div key={s.label} className="bg-gray-50 rounded-lg p-2.5 text-center">
                      <p className="text-[10px] text-gray-400 mb-0.5">{s.label}</p>
                      <p className="text-sm font-bold text-gray-800">{s.value}</p>
                      <p className="text-[9px] text-gray-400">/ {s.total} clients</p>
                    </div>
                  ))}
                </div>
              )}

              {/* ── Barre progression objectif ───────────── */}
              {objectifMontant > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-medium">Progression vers l'objectif</span>
                    <span className={`font-bold ${atteint ? "text-green-600" : "text-gray-700"}`}>
                      {Math.round(pctObjectif)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all ${
                        atteint ? "bg-green-500" : pctObjectif >= 70 ? "bg-blue-500" : pctObjectif >= 40 ? "bg-amber-400" : "bg-red-400"
                      }`}
                      style={{ width: `${pctObjectif}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-400">
                    <span>Réalisé : <strong className="text-gray-600">{formatEur(c.caMois)}</strong></span>
                    <span>{atteint
                      ? <span className="text-green-600 font-semibold">Objectif dépassé de {formatEur(c.caMois - objectifMontant)} ✓</span>
                      : `Manque ${formatEur(objectifMontant - c.caMois)}`
                    }</span>
                  </div>
                </div>
              )}

              {/* Objectif précédent */}
              {c.objectifPrevAtteint !== null && (
                <div className={`flex items-center gap-2 text-xs rounded-lg px-3 py-2 ${
                  c.objectifPrevAtteint ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
                }`}>
                  {c.objectifPrevAtteint
                    ? <CheckCircle className="w-4 h-4 flex-shrink-0" />
                    : <XCircle className="w-4 h-4 flex-shrink-0" />}
                  Objectif de {moisPrevLabel} {c.objectifPrevAtteint ? "atteint" : "non atteint"}
                  {c.caPrev > 0 && (
                    <span className="ml-auto font-semibold">{formatEur(c.caPrev)}</span>
                  )}
                </div>
              )}

              {/* ── Graphique CA (12 derniers mois) ─────── */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">Évolution CA — 12 derniers mois</p>
                {chartData.length === 0 ? (
                  <div className="bg-gray-50 rounded-xl p-6 text-center text-xs text-gray-400">
                    Aucune donnée historique
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-3">
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                        <defs>
                          <linearGradient id={`grad-${c.user.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#1E40AF" stopOpacity={0.25} />
                            <stop offset="95%" stopColor="#1E40AF" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fontSize: 9 }} tickLine={false} />
                        <YAxis
                          tick={{ fontSize: 9 }} tickLine={false} axisLine={false}
                          tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                          width={28}
                        />
                        <Tooltip
                          formatter={(v: unknown) => typeof v === "number" ? [formatEur(v), "CA"] : ["—", "CA"]}
                        />
                        {objectifMontant > 0 && (
                          <ReferenceLine
                            y={objectifMontant} stroke="#F59E0B" strokeDasharray="5 3" strokeWidth={1.5}
                            label={{ value: "Objectif", position: "insideTopRight", fontSize: 9, fill: "#D97706" }}
                          />
                        )}
                        <Area
                          type="monotone" dataKey="ca"
                          stroke="#1E40AF" strokeWidth={2}
                          fill={`url(#grad-${c.user.id})`}
                          dot={(props) => {
                            const { cx, cy, payload } = props;
                            if (!payload.isCurrent) return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={0} />;
                            return <circle key={`dot-${cx}-${cy}`} cx={cx} cy={cy} r={4} fill="#1E40AF" stroke="white" strokeWidth={2} />;
                          }}
                          name="CA"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                    {objectifMontant > 0 && (
                      <p className="text-[9px] text-amber-600 text-right mt-1">
                        — Ligne objectif : {formatEur(objectifMontant)}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* ── Calendrier historique ────────────────── */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-700">Calendrier historique (€)</p>
                <CalendrierHistorique
                  evolution={detail?.evolutionTousMois ?? []}
                  moisActuel={mois}
                  anneeActuelle={annee}
                />
              </div>

              {/* ── N-1 comparaison ──────────────────────── */}
              <div className="bg-gray-50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-gray-400">Même mois, année précédente (N-1)</p>
                  <p className="text-sm font-bold text-gray-800">{c.caN1 > 0 ? formatEur(c.caN1) : "Pas de données"}</p>
                </div>
                {c.caN1 > 0 && (
                  <span className={`text-sm font-bold ${variationColor(c.caMois > 0 ? ((c.caMois - c.caN1) / c.caN1) * 100 : null)}`}>
                    {c.caMois > 0
                      ? `${((c.caMois - c.caN1) / c.caN1) >= 0 ? "+" : ""}${(((c.caMois - c.caN1) / c.caN1) * 100).toFixed(1)}%`
                      : "—"}
                  </span>
                )}
              </div>

              {/* ── Recommandation ───────────────────────── */}
              <div className={`rounded-xl p-4 space-y-2.5 ${
                c.recommandation.montant > 0 ? "bg-amber-50 border border-amber-200" : "bg-gray-50 border border-gray-200"
              }`}>
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-gray-700">
                    {c.recommandation.montant > 0 ? "Recommandation objectif" : "Données insuffisantes"}
                  </p>
                  {c.recommandation.montant > 0 && (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                      c.recommandation.confiance === "haute" ? "bg-green-100 text-green-700" :
                      c.recommandation.confiance === "moyenne" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-500"
                    }`}>
                      {c.recommandation.confiance === "haute" ? "Fiable" :
                       c.recommandation.confiance === "moyenne" ? "Estimé" : "Faible"}
                    </span>
                  )}
                </div>
                {c.recommandation.montant > 0 ? (
                  <>
                    <p className="text-xl font-bold text-amber-700">{formatEur(c.recommandation.montant)}</p>
                    <p className="text-[11px] text-amber-700 leading-relaxed">{c.recommandation.raisonnement}</p>
                    <button
                      onClick={() => { setInputVal(String(c.recommandation.montant)); setSaved(false); }}
                      className="w-full text-xs font-semibold py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      Utiliser cette recommandation
                    </button>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <AlertTriangle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    {c.recommandation.raisonnement}
                  </div>
                )}
              </div>

              {/* ── Saisie objectif ──────────────────────── */}
              <div className="space-y-2.5 pb-4">
                <label className="text-xs font-bold text-gray-700">
                  {c.objectif ? "Modifier l'objectif" : "Définir l'objectif"} — {MOIS_NOMS[mois - 1]} {annee}
                </label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={inputVal}
                    onChange={(e) => { setInputVal(e.target.value); setSaved(false); setErr(""); }}
                    placeholder="Ex: 15 000"
                    className={`flex-1 text-sm border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                      err ? "border-red-400" : "border-gray-200"
                    }`}
                  />
                  <button
                    onClick={handleSave}
                    disabled={saving || !inputVal}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold rounded-lg bg-[#1E40AF] text-white hover:bg-blue-700 disabled:opacity-40 transition-colors whitespace-nowrap"
                  >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                     : saved ? <CheckCircle className="w-3.5 h-3.5" />
                     : <Save className="w-3.5 h-3.5" />}
                    {saving ? "..." : saved ? "Sauvegardé ✓" : "Sauvegarder"}
                  </button>
                </div>
                {err && <p className="text-[11px] text-red-500">{err}</p>}
                {inputVal && !err && (() => {
                  const montant = parseFloat(inputVal);
                  if (!isNaN(montant) && c.caPrev > 0) {
                    const taux = ((montant - c.caPrev) / c.caPrev) * 100;
                    return (
                      <p className="text-[11px] text-gray-400">
                        Croissance vs {moisPrevLabel} : <strong className={taux >= 0 ? "text-green-600" : "text-red-500"}>
                          {taux >= 0 ? "+" : ""}{taux.toFixed(1)}%
                        </strong>
                        {c.caN1 > 0 && (() => {
                          const tauxN1 = ((montant - c.caN1) / c.caN1) * 100;
                          return (
                            <> · vs N-1 : <strong className={tauxN1 >= 0 ? "text-green-600" : "text-red-500"}>
                              {tauxN1 >= 0 ? "+" : ""}{tauxN1.toFixed(1)}%
                            </strong></>
                          );
                        })()}
                      </p>
                    );
                  }
                  return null;
                })()}
              </div>

            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Vue commerciale (lecture seule) ─────────────────────────────────────────

function CommercialSelfView({ userId }: { userId: string }) {
  const now = new Date();
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());
  const [objectif, setObjectif] = useState<{ montantCible: number; tauxCroissance: number | null } | null>(null);
  const [caMois, setCaMois] = useState(0);
  const [loading, setLoading] = useState(true);

  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const maxMois = nextMonthDate.getMonth() + 1;
  const maxAnnee = nextMonthDate.getFullYear();

  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch(`/api/objectifs?commercialId=${userId}&mois=${mois}&annee=${annee}`).then((r) => r.json()),
      fetch(`/api/commercial/${userId}?mois=${mois}&annee=${annee}`).then((r) => r.json()),
    ])
      .then(([objData, commData]) => {
        setObjectif(objData.objectif ?? null);
        setCaMois(commData.stats?.caMois ?? 0);
      })
      .catch(() => { setObjectif(null); setCaMois(0); })
      .finally(() => setLoading(false));
  }, [userId, mois, annee]);

  function naviguerMois(delta: number) {
    let m = mois + delta;
    let a = annee;
    if (m > 12) { m = 1; a++; }
    if (m < 1) { m = 12; a--; }
    setMois(m); setAnnee(a);
  }

  const moisLabel = `${MOIS_NOMS[mois - 1]} ${annee}`;
  const jours = joursEcoules(mois, annee);
  const joursTotaux = daysInMonth(mois, annee);
  const caJour = jours > 0 ? caMois / jours : 0;
  const projection = caJour * joursTotaux;
  const objectifMontant = objectif?.montantCible ?? 0;
  const pct = objectifMontant > 0 ? Math.min(Math.round((caMois / objectifMontant) * 100), 100) : 0;
  const atteint = objectifMontant > 0 && caMois >= objectifMontant;

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Header title="Mon Objectif" subtitle={`Suivi mensuel — ${moisLabel}`} />
          <Target className="w-5 h-5 text-[#1E40AF]" />
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <button onClick={() => naviguerMois(-1)} className="p-1 rounded hover:bg-gray-100">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-800 w-36 text-center">{moisLabel}</span>
          <button
            onClick={() => naviguerMois(1)}
            className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
            disabled={mois === maxMois && annee === maxAnnee}
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#1E40AF]" />
        </div>
      ) : !objectif ? (
        <div className="max-w-lg bg-white rounded-xl border border-gray-200 p-10 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto">
            <Target className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-600">Aucun objectif pour {moisLabel}</p>
          <p className="text-xs text-gray-400">Votre responsable n'a pas encore fixé d'objectif pour ce mois.</p>
        </div>
      ) : (
        <div className="max-w-xl space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <KPIStat label="Objectif mensuel" value={formatEur(objectifMontant)}
              sub={`${MOIS_NOMS[mois - 1]} ${annee}`} icon={Target} color="blue" small />
            <KPIStat label="CA réalisé" value={formatEur(caMois)}
              sub={atteint ? "Objectif atteint ✓" : `${pct}% atteint`}
              icon={Euro} color={atteint ? "green" : caMois > 0 ? "blue" : "gray"} small />
            <KPIStat label="Moy. journalière" value={`${formatEur(Math.round(caJour))}/j`}
              sub={jours > 0 ? `${jours} jours écoulés sur ${joursTotaux}` : "Mois non commencé"}
              icon={CalendarDays} color="amber" small />
            <KPIStat label="Projection fin mois" value={formatEur(Math.round(projection))}
              sub={objectifMontant > 0
                ? projection >= objectifMontant
                  ? `+${formatEur(Math.round(projection - objectifMontant))} sur l'objectif`
                  : `Manque ${formatEur(Math.round(objectifMontant - projection))}`
                : `${joursTotaux} jours au total`}
              icon={Crosshair} color={projection >= objectifMontant ? "green" : "red"} small />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-semibold text-gray-700">Progression vers l'objectif</span>
              <span className={`text-lg font-bold ${atteint ? "text-green-600" : "text-gray-800"}`}>{pct}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4">
              <div
                className={`h-4 rounded-full transition-all duration-500 ${
                  atteint ? "bg-green-500" : pct >= 70 ? "bg-blue-500" : pct >= 40 ? "bg-amber-400" : "bg-red-400"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Réalisé : <strong className="text-gray-700">{formatEur(caMois)}</strong></span>
              {atteint ? (
                <span className="text-green-600 font-semibold">Dépassé de {formatEur(caMois - objectifMontant)} ✓</span>
              ) : (
                <span>Manque : <strong className="text-gray-700">{formatEur(objectifMontant - caMois)}</strong></span>
              )}
            </div>
          </div>

          {objectif.tauxCroissance !== null && (
            <div className="bg-gray-50 rounded-xl border border-gray-100 p-3 flex items-center justify-between">
              <span className="text-sm text-gray-600">Évolution vs mois précédent</span>
              <span className={`text-sm font-bold ${objectif.tauxCroissance >= 0 ? "text-green-600" : "text-red-500"}`}>
                {objectif.tauxCroissance >= 0 ? "+" : ""}{objectif.tauxCroissance.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page principale ─────────────────────────────────────────────────────────

export default function ObjectifsPage() {
  const { data: session, status } = useSession();
  const now = new Date();
  const [mois, setMois] = useState(now.getMonth() + 1);
  const [annee, setAnnee] = useState(now.getFullYear());
  // Navigation max : 1 mois dans le futur
  const nextMonthDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const maxMois = nextMonthDate.getMonth() + 1;
  const maxAnnee = nextMonthDate.getFullYear();
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/objectifs?mois=${mois}&annee=${annee}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [mois, annee]);

  useEffect(() => {
    setSelectedId(null);
    fetchData();
  }, [fetchData]);

  function naviguerMois(delta: number) {
    let m = mois + delta;
    let a = annee;
    if (m > 12) { m = 1; a++; }
    if (m < 1) { m = 12; a--; }
    setMois(m);
    setAnnee(a);
  }

  function handleSaved(commercialId: string, montant: number) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        commerciaux: prev.commerciaux.map((c) =>
          c.user.id === commercialId
            ? {
                ...c,
                objectif: {
                  id: "",
                  montantCible: montant,
                  tauxCroissance: c.caPrev > 0 ? ((montant - c.caPrev) / c.caPrev) * 100 : null,
                },
              }
            : c
        ),
      };
    });
  }

  if (status === "loading") {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-[#1E40AF]" /></div>;
  }

  // Non-admin : vue lecture seule de ses propres objectifs
  if (session?.user?.role !== Role.ADMIN) {
    return <CommercialSelfView userId={session?.user?.id ?? "me"} />;
  }

  const g = data?.global;
  const moisLabel = `${MOIS_NOMS[mois - 1]} ${annee}`;
  const moisPrevLabel = mois === 1 ? `Déc. ${annee - 1}` : MOIS_NOMS[mois - 2];
  const selectedCommercial = data?.commerciaux.find((c) => c.user.id === selectedId) ?? null;

  // Projection totale des objectifs fixés par l'admin (mise à jour dynamique)
  const totalObjectifs = data?.commerciaux.reduce((s, c) => s + (c.objectif?.montantCible ?? 0), 0) ?? 0;
  const nbObjectifsDef = data?.commerciaux.filter((c) => c.objectif).length ?? 0;
  const nbTotalComm = data?.commerciaux.length ?? 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Header title="Objectifs Commerciaux" subtitle={`Suivi & prévisions — ${moisLabel}`} />
          <Target className="w-5 h-5 text-[#1E40AF]" />
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-sm">
          <button onClick={() => naviguerMois(-1)} className="p-1 rounded hover:bg-gray-100">
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-800 w-36 text-center">{moisLabel}</span>
          <button
            onClick={() => naviguerMois(1)} className="p-1 rounded hover:bg-gray-100"
            disabled={mois === maxMois && annee === maxAnnee}
          >
            <ChevronRight className="w-4 h-4 text-gray-600 disabled:opacity-30" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-[#1E40AF]" />
        </div>
      ) : !data ? null : (
        <>
          {/* ── Section globale ─────────────────────────────── */}
          <div className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <KPIStat
                label={`CA total — ${moisLabel}`}
                value={formatEur(g!.caTotal)}
                sub={`${data.commerciaux.filter((c) => c.caMois > 0).length} commerciaux actifs`}
                icon={Euro} color="blue"
              />
              <KPIStat
                label={`vs ${moisPrevLabel}`}
                value={g!.variationPrev !== null ? `${g!.variationPrev >= 0 ? "+" : ""}${g!.variationPrev.toFixed(1)}%` : "—"}
                sub={g!.caPrev > 0 ? formatEur(g!.caPrev) : "Pas de données"}
                icon={g!.variationPrev !== null && g!.variationPrev >= 0 ? TrendingUp : TrendingDown}
                color={g!.variationPrev === null ? "gray" : g!.variationPrev >= 0 ? "green" : "red"}
              />
              <KPIStat
                label={`vs ${MOIS_NOMS[mois - 1]} N-1`}
                value={g!.variationN1 !== null ? `${g!.variationN1 >= 0 ? "+" : ""}${g!.variationN1.toFixed(1)}%` : "—"}
                sub={g!.caN1 > 0 ? formatEur(g!.caN1) : "Pas de données N-1"}
                icon={g!.variationN1 !== null && g!.variationN1 >= 0 ? TrendingUp : TrendingDown}
                color={g!.variationN1 === null ? "gray" : g!.variationN1 >= 0 ? "green" : "red"}
              />
              <KPIStat
                label="Prévision (tendance)"
                value={g!.prediction > 0 ? formatEur(g!.prediction) : "—"}
                sub="Régression 6 derniers mois"
                icon={Crosshair} color="amber"
              />
              {/* KPI dynamique : total des objectifs fixés par l'admin */}
              <div className="bg-white rounded-xl border-2 border-blue-300 p-4 relative overflow-hidden">
                <div className="flex items-center gap-2 mb-1">
                  <span className="p-1.5 rounded-lg bg-blue-50 text-blue-600">
                    <Target className="w-3.5 h-3.5" />
                  </span>
                  <span className="text-xs text-gray-500 font-medium">Projection objectifs</span>
                </div>
                <p className="font-bold text-gray-900 text-lg">
                  {totalObjectifs > 0 ? formatEur(totalObjectifs) : "—"}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {nbObjectifsDef}/{nbTotalComm} commerciaux configurés
                </p>
                {nbObjectifsDef > 0 && nbObjectifsDef < nbTotalComm && (
                  <p className="text-[10px] text-amber-500 mt-1 font-medium">
                    {nbTotalComm - nbObjectifsDef} sans objectif
                  </p>
                )}
                {nbObjectifsDef === nbTotalComm && nbTotalComm > 0 && (
                  <p className="text-[10px] text-green-600 mt-1 font-medium">Tous configurés ✓</p>
                )}
              </div>
            </div>
            {g!.histo.length > 0 && (
              <GlobalChart histo={g!.histo} prediction={g!.prediction} mois={mois} annee={annee} />
            )}
          </div>

          {/* ── Liste commerciaux ──────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-gray-800">Commerciaux — {moisLabel}</h2>
              <span className="text-xs text-gray-400">
                {data.commerciaux.filter((c) => c.objectif).length}/{data.commerciaux.length} objectifs définis · Cliquez pour le détail
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {data.commerciaux.map((c) => (
                <CommercialCard
                  key={c.user.id} c={c} mois={mois} annee={annee}
                  isSelected={selectedId === c.user.id}
                  onClick={() => setSelectedId(selectedId === c.user.id ? null : c.user.id)}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── Panel latéral ─────────────────────────────────── */}
      {selectedCommercial && (
        <CommercialPanel
          c={selectedCommercial} mois={mois} annee={annee}
          onClose={() => setSelectedId(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
