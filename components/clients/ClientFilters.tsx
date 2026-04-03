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
  { value: "derniereCommande", label: "Dernière commande" },
  { value: "nbCommandes", label: "Nb. commandes" },
  { value: "panierMoyen", label: "Panier moyen" },
];

const STATUTS: { value: string; label: string; color: string; active: string }[] = [
  { value: "stratégiques", label: "Stratégiques", color: "bg-blue-100 text-blue-800 border-blue-200",   active: "bg-blue-600 text-white border-blue-600" },
  { value: "réguliers",    label: "Réguliers",    color: "bg-green-100 text-green-800 border-green-200", active: "bg-green-600 text-white border-green-600" },
  { value: "occasionnels", label: "Occasionnels", color: "bg-amber-100 text-amber-800 border-amber-200", active: "bg-amber-500 text-white border-amber-500" },
  { value: "nouveaux",     label: "Nouveaux",     color: "bg-violet-100 text-violet-800 border-violet-200", active: "bg-violet-600 text-white border-violet-600" },
  { value: "perdus",       label: "Perdus",       color: "bg-red-100 text-red-800 border-red-200",     active: "bg-red-600 text-white border-red-600" },
  { value: "prospect",     label: "Prospect",     color: "bg-gray-100 text-gray-600 border-gray-200",  active: "bg-gray-600 text-white border-gray-600" },
];

// Sous-catégories groupées par catégorie parente
const SOUS_CAT_GROUPS: { statut: string; label: string; color: string; items: string[] }[] = [
  { statut: "stratégiques", label: "Stratégiques", color: "text-blue-700",   items: ["Tres frequent", "Mensuel", "Bimestriel"] },
  { statut: "réguliers",    label: "Réguliers",    color: "text-green-700",  items: ["Fidèle", "Tres regulier", "Regulier"] },
  { statut: "occasionnels", label: "Occasionnels", color: "text-amber-700",  items: ["Frequent", "Peu frequent", "Rare", "Tres rare"] },
  { statut: "nouveaux",     label: "Nouveaux",     color: "text-violet-700", items: ["Fidelisation rapide", "En developpement", "Premier achat"] },
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
  sousCategorieFilter: string;
  categorieTypeFilter: string;
  commercialFilter: string;
  villes: string[];
  categorieTypes: string[];
  sousCategories: string[];
  commerciaux: Commercial[];
  onFilterChange: (f: string) => void;
  onSearchChange: (s: string) => void;
  onSortByChange: (s: string) => void;
  onSortOrderToggle: () => void;
  onEtagereFilterChange: (v: string) => void;
  onVilleFilterChange: (v: string) => void;
  onCategorieStatutChange: (v: string) => void;
  onSousCategorieChange: (v: string) => void;
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
  sousCategorieFilter,
  categorieTypeFilter,
  commercialFilter,
  villes,
  categorieTypes,
  sousCategories,
  commerciaux,
  onFilterChange,
  onSearchChange,
  onSortByChange,
  onSortOrderToggle,
  onEtagereFilterChange,
  onVilleFilterChange,
  onCategorieStatutChange,
  onSousCategorieChange,
  onCategorieTypeChange,
  onCommercialFilterChange,
  onReset,
}: ClientFiltersProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const hasAdvancedFilters = !!(villeFilter || categorieStatutFilter || sousCategorieFilter || categorieTypeFilter || etagereFilter || commercialFilter);

  const activeCount = [villeFilter, categorieStatutFilter, sousCategorieFilter, categorieTypeFilter, etagereFilter, commercialFilter]
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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">

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

            {/* Catégorie client — pills colorées */}
            <div className="sm:col-span-2 xl:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">Catégorie client</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => { onCategorieStatutChange(""); onSousCategorieChange(""); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    !categorieStatutFilter
                      ? "bg-gray-700 text-white border-gray-700"
                      : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200"
                  }`}
                >
                  Toutes
                </button>
                {STATUTS.map((s) => (
                  <button
                    key={s.value}
                    onClick={() => {
                      if (categorieStatutFilter === s.value) {
                        onCategorieStatutChange("");
                        onSousCategorieChange("");
                      } else {
                        onCategorieStatutChange(s.value);
                        onSousCategorieChange("");
                      }
                    }}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                      categorieStatutFilter === s.value ? s.active : s.color + " hover:opacity-80"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Sous-catégorie — groupée par catégorie */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sous-catégorie</label>
              <select
                value={sousCategorieFilter}
                onChange={(e) => onSousCategorieChange(e.target.value)}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="">Toutes</option>
                {(categorieStatutFilter
                  ? SOUS_CAT_GROUPS.filter((g) => g.statut === categorieStatutFilter)
                  : SOUS_CAT_GROUPS
                ).map((group) => (
                  <optgroup key={group.statut} label={`── ${group.label}`}>
                    {group.items.map((item) => (
                      <option key={item} value={item}>{item}</option>
                    ))}
                  </optgroup>
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
              {categorieStatutFilter && (() => {
                const s = STATUTS.find((x) => x.value === categorieStatutFilter);
                return (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border font-medium ${s ? s.active : "bg-blue-100 text-blue-700 border-blue-200"}`}>
                    {s?.label ?? categorieStatutFilter}
                    <button onClick={() => { onCategorieStatutChange(""); onSousCategorieChange(""); }}><X className="w-3 h-3" /></button>
                  </span>
                );
              })()}
              {sousCategorieFilter && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                  Sous-cat. : {sousCategorieFilter}
                  <button onClick={() => onSousCategorieChange("")}><X className="w-3 h-3" /></button>
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
