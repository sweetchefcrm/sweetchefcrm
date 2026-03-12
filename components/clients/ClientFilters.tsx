"use client";

import { useState } from "react";
import { Search, ArrowUpDown, SlidersHorizontal, X } from "lucide-react";

const FILTERS = [
  { value: "all",            label: "Tous" },
  { value: "actif",          label: "Accessibles (6 mois)" },
  { value: "active_month",   label: "Commandé ce mois" },
  { value: "no_order_month", label: "Pas commandé ce mois" },
  { value: "inactive",       label: "Inaccessibles (6 mois)" },
  { value: "new",            label: "Nouveaux" },
];

const SORT_OPTIONS = [
  { value: "nom", label: "Nom" },
  { value: "codeClient", label: "Code" },
  { value: "codePostal", label: "Code Postal" },
  { value: "categorieStatut", label: "Catégorie" },
  { value: "etagere", label: "Étagère" },
];

const STATUTS = [
  "stratégiques",
  "réguliers",
  "occasionnels",
  "nouveaux",
  "perdus",
  "prospect",
];

const ETAGERE_OPTIONS = [
  { value: "", label: "Toutes" },
  { value: "oui", label: "Avec étagère" },
  { value: "non", label: "Sans étagère" },
];

interface Commercial { id: string; name: string; }

interface ClientFiltersProps {
  filter: string;
  search: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
  etagereFilter: string;
  villeFilter: string;
  categorieStatutFilter: string;
  categorieTypeFilter: string;
  commercialFilter: string;
  villes: string[];
  categorieTypes: string[];
  commerciaux: Commercial[];
  onFilterChange: (f: string) => void;
  onSearchChange: (s: string) => void;
  onSortByChange: (s: string) => void;
  onSortOrderToggle: () => void;
  onEtagereFilterChange: (v: string) => void;
  onVilleFilterChange: (v: string) => void;
  onCategorieStatutChange: (v: string) => void;
  onCategorieTypeChange: (v: string) => void;
  onCommercialFilterChange: (v: string) => void;
  onReset: () => void;
}

export default function ClientFilters({
  filter,
  search,
  sortBy,
  sortOrder,
  etagereFilter,
  villeFilter,
  categorieStatutFilter,
  categorieTypeFilter,
  commercialFilter,
  villes,
  categorieTypes,
  commerciaux,
  onFilterChange,
  onSearchChange,
  onSortByChange,
  onSortOrderToggle,
  onEtagereFilterChange,
  onVilleFilterChange,
  onCategorieStatutChange,
  onCategorieTypeChange,
  onCommercialFilterChange,
  onReset,
}: ClientFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasAdvancedFilters = !!(villeFilter || categorieStatutFilter || categorieTypeFilter || etagereFilter || commercialFilter);

  const activeCount = [villeFilter, categorieStatutFilter, categorieTypeFilter, etagereFilter, commercialFilter]
    .filter(Boolean).length;

  return (
    <div className="space-y-3">
      {/* Ligne principale */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Recherche */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher un client..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tri */}
        <div className="flex items-center gap-1.5">
          <select
            value={sortBy}
            onChange={(e) => onSortByChange(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={onSortOrderToggle}
            title={sortOrder === "asc" ? "Croissant" : "Décroissant"}
            className="p-2 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-600 transition-colors"
          >
            <ArrowUpDown className={`w-4 h-4 ${sortOrder === "asc" ? "text-blue-600" : "text-gray-400"}`} />
          </button>
        </div>

        {/* Bouton filtres avancés */}
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
            showAdvanced || hasAdvancedFilters
              ? "bg-blue-50 border-blue-300 text-blue-700"
              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filtres avancés
          {activeCount > 0 && (
            <span className="bg-blue-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>

        {/* Reset */}
        {(hasAdvancedFilters || search || filter !== "all") && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 border border-red-200 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Réinitialiser
          </button>
        )}
      </div>

      {/* Panneau filtres avancés */}
      {showAdvanced && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Filtres avancés — combinables</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">

            {/* Code Postal */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Code Postal</label>
              <select
                value={villeFilter}
                onChange={(e) => onVilleFilterChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Tous les codes</option>
                {villes.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </div>

            {/* Catégorie statut */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie client</label>
              <select
                value={categorieStatutFilter}
                onChange={(e) => onCategorieStatutChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Toutes les catégories</option>
                {STATUTS.map((s) => (
                  <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                ))}
              </select>
            </div>

            {/* Type métier */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type métier</label>
              <select
                value={categorieTypeFilter}
                onChange={(e) => onCategorieTypeChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Tous les types</option>
                {categorieTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Étagère */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Étagère vendue</label>
              <select
                value={etagereFilter}
                onChange={(e) => onEtagereFilterChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {ETAGERE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* Commercial */}
            {commerciaux.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Commercial</label>
                <select
                  value={commercialFilter}
                  onChange={(e) => onCommercialFilterChange(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">Tous les commerciaux</option>
                  {commerciaux.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Tags filtres actifs */}
          {hasAdvancedFilters && (
            <div className="flex flex-wrap gap-2 pt-1">
              {villeFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  CP : {villeFilter}
                  <button onClick={() => onVilleFilterChange("")}><X className="w-3 h-3" /></button>
                </span>
              )}
              {categorieStatutFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  Catégorie : {categorieStatutFilter}
                  <button onClick={() => onCategorieStatutChange("")}><X className="w-3 h-3" /></button>
                </span>
              )}
              {categorieTypeFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  Type : {categorieTypeFilter}
                  <button onClick={() => onCategorieTypeChange("")}><X className="w-3 h-3" /></button>
                </span>
              )}
              {etagereFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  Étagère : {etagereFilter}
                  <button onClick={() => onEtagereFilterChange("")}><X className="w-3 h-3" /></button>
                </span>
              )}
              {commercialFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                  Commercial : {commerciaux.find((c) => c.id === commercialFilter)?.name ?? commercialFilter}
                  <button onClick={() => onCommercialFilterChange("")}><X className="w-3 h-3" /></button>
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Onglets rapides */}
      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => onFilterChange(f.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === f.value
                ? "bg-[#1E40AF] text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
