"use client";

import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";

const GEO_URL = "/france-departments.geojson";

const CATEGORY_COLORS: Record<string, string> = {
  "stratégiques": "#3b82f6",
  "réguliers": "#22c55e",
  "occasionnels": "#f59e0b",
  "nouveaux": "#a855f7",
  "perdus": "#ef4444",
  "prospect": "#6b7280",
};

const FILTER_TABS = [
  { value: "all", label: "Tous" },
  { value: "actif", label: "Accessibles (6 mois)" },
  { value: "inactive", label: "Inaccessibles" },
  { value: "active_month", label: "Commandé ce mois" },
  { value: "no_order_month", label: "Pas commandé ce mois" },
  { value: "new", label: "Nouveaux" },
];

type DeptStat = {
  code: string;
  count: number;
  totalCA: number;
  categories: Record<string, number>;
  etagereCount: number;
};

type ClientRow = {
  id: string;
  nom: string;
  codeClient: string;
  codePostal?: string | null;
  categorieStatut?: string | null;
  sousCategorie?: string | null;
  etagere: boolean;
  panierMoyen: number;
  commercial: { name: string };
  _count: { ventes: number };
};

type Options = {
  commerciaux: { id: string; name: string }[];
  types: string[];
  sousCategories: string[];
};

function getCountColor(count: number, max: number): string {
  if (!count || max === 0) return "#e5e7eb";
  const r = count / max;
  if (r < 0.1) return "#dbeafe";
  if (r < 0.25) return "#93c5fd";
  if (r < 0.5) return "#60a5fa";
  if (r < 0.75) return "#3b82f6";
  return "#1d4ed8";
}

function getCAColor(ca: number, max: number): string {
  if (!ca || max === 0) return "#e5e7eb";
  const r = ca / max;
  if (r < 0.1) return "#d1fae5";
  if (r < 0.25) return "#6ee7b7";
  if (r < 0.5) return "#34d399";
  if (r < 0.75) return "#10b981";
  return "#047857";
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 0 });
}

export default function MapClient() {
  const { data: session } = useSession();
  const [filter, setFilter] = useState("all");
  const [commercialFilter, setCommercialFilter] = useState("");
  const [categorieFilter, setCategorieFilter] = useState("");
  const [sousCategorieFilter, setSousCategorieFilter] = useState("");
  const [categorieTypeFilter, setCategorieTypeFilter] = useState("");
  const [etagereFilter, setEtagereFilter] = useState("");
  const [colorMode, setColorMode] = useState<"count" | "ca">("count");

  const [departments, setDepartments] = useState<DeptStat[]>([]);
  const [options, setOptions] = useState<Options>({ commerciaux: [], types: [], sousCategories: [] });
  const [selectedDept, setSelectedDept] = useState<string | null>(null);
  const [selectedDeptNom, setSelectedDeptNom] = useState("");
  const [deptClients, setDeptClients] = useState<ClientRow[]>([]);
  const [loadingMap, setLoadingMap] = useState(false);
  const [loadingClients, setLoadingClients] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [hoveredDept, setHoveredDept] = useState<(DeptStat & { nom: string }) | null>(null);

  const canFilterByCommercial = ["ADMIN", "COMMERCIAL_PRINCIPAL", "CHEF_TERRAIN", "CHEF_TELEVENTE"].includes(
    session?.user?.role || ""
  );

  // Track cursor for tooltip
  useEffect(() => {
    const onMove = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  // Fetch options once
  useEffect(() => {
    fetch("/api/clients/options")
      .then((r) => r.json())
      .then((d) =>
        setOptions({
          commerciaux: d.commerciaux || [],
          types: d.types || [],
          sousCategories: d.sousCategories || [],
        })
      );
  }, []);

  // Fetch department stats
  const fetchDepts = useCallback(() => {
    setLoadingMap(true);
    const p = new URLSearchParams();
    if (filter !== "all") p.set("filter", filter);
    if (commercialFilter) p.set("commercial", commercialFilter);
    if (categorieFilter) p.set("categorieStatut", categorieFilter);
    if (sousCategorieFilter) p.set("sousCategorie", sousCategorieFilter);
    if (categorieTypeFilter) p.set("categorieType", categorieTypeFilter);
    if (etagereFilter) p.set("etagere", etagereFilter);
    fetch(`/api/map?${p}`)
      .then((r) => r.json())
      .then((d) => setDepartments(d.departments || []))
      .finally(() => setLoadingMap(false));
  }, [filter, commercialFilter, categorieFilter, sousCategorieFilter, categorieTypeFilter, etagereFilter]);

  useEffect(() => {
    fetchDepts();
  }, [fetchDepts]);

  // Fetch clients for selected dept
  useEffect(() => {
    if (!selectedDept) {
      setDeptClients([]);
      return;
    }
    setLoadingClients(true);
    const p = new URLSearchParams({ dept: selectedDept, limit: "100" });
    if (filter !== "all") p.set("filter", filter);
    if (commercialFilter) p.set("commercial", commercialFilter);
    if (categorieFilter) p.set("categorieStatut", categorieFilter);
    if (sousCategorieFilter) p.set("sousCategorie", sousCategorieFilter);
    if (categorieTypeFilter) p.set("categorieType", categorieTypeFilter);
    if (etagereFilter) p.set("etagere", etagereFilter);
    fetch(`/api/map/clients?${p}`)
      .then((r) => r.json())
      .then((d) => setDeptClients(d.clients || []))
      .finally(() => setLoadingClients(false));
  }, [selectedDept, filter, commercialFilter, categorieFilter, sousCategorieFilter, categorieTypeFilter, etagereFilter]);

  const deptMap = new Map(departments.map((d) => [d.code, d]));
  const maxCount = Math.max(...departments.map((d) => d.count), 1);
  const maxCA = Math.max(...departments.map((d) => d.totalCA), 1);
  const selectedStat = selectedDept ? deptMap.get(selectedDept) : null;

  const totalClients = departments.reduce((s, d) => s + d.count, 0);
  const totalCA = departments.reduce((s, d) => s + d.totalCA, 0);
  const totalEtagere = departments.reduce((s, d) => s + d.etagereCount, 0);

  const resetFilters = () => {
    setFilter("all");
    setCommercialFilter("");
    setCategorieFilter("");
    setSousCategorieFilter("");
    setCategorieTypeFilter("");
    setEtagereFilter("");
  };

  const hasActiveFilter =
    filter !== "all" || commercialFilter || categorieFilter || sousCategorieFilter || categorieTypeFilter || etagereFilter;

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-900">Carte des clients</h1>
          <div className="flex gap-3 text-sm">
            <div className="bg-blue-50 px-3 py-1.5 rounded-lg">
              <span className="text-blue-700 font-semibold">{fmt(totalClients)}</span>
              <span className="text-gray-500 ml-1">clients</span>
            </div>
            <div className="bg-green-50 px-3 py-1.5 rounded-lg">
              <span className="text-green-700 font-semibold">{fmt(totalCA)} €</span>
              <span className="text-gray-500 ml-1">CA</span>
            </div>
            <div className="bg-amber-50 px-3 py-1.5 rounded-lg">
              <span className="text-amber-700 font-semibold">{fmt(totalEtagere)}</span>
              <span className="text-gray-500 ml-1">étagères</span>
            </div>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1 mb-3 flex-wrap">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                filter === tab.value ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Advanced filters row */}
        <div className="flex gap-2 flex-wrap items-center">
          {canFilterByCommercial && options.commerciaux.length > 0 && (
            <select
              value={commercialFilter}
              onChange={(e) => setCommercialFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tous les commerciaux</option>
              {options.commerciaux.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}

          <select
            value={categorieFilter}
            onChange={(e) => setCategorieFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Toutes catégories</option>
            {["stratégiques", "réguliers", "occasionnels", "nouveaux", "perdus", "prospect"].map((v) => (
              <option key={v} value={v}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </option>
            ))}
          </select>

          {options.sousCategories.length > 0 && (
            <select
              value={sousCategorieFilter}
              onChange={(e) => setSousCategorieFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Toutes sous-catégories</option>
              {options.sousCategories.map((sc) => (
                <option key={sc} value={sc}>
                  {sc}
                </option>
              ))}
            </select>
          )}

          {options.types.length > 0 && (
            <select
              value={categorieTypeFilter}
              onChange={(e) => setCategorieTypeFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">Tous types métier</option>
              {options.types.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}

          <select
            value={etagereFilter}
            onChange={(e) => setEtagereFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">Étagère : tous</option>
            <option value="oui">Avec étagère</option>
            <option value="non">Sans étagère</option>
          </select>

          {hasActiveFilter && (
            <button
              onClick={resetFilters}
              className="text-xs text-red-500 hover:text-red-700 px-2 py-1.5 hover:bg-red-50 rounded-lg transition-colors"
            >
              Réinitialiser
            </button>
          )}

          {/* Color mode */}
          <div className="ml-auto flex gap-1 bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setColorMode("count")}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                colorMode === "count" ? "bg-white text-blue-700 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Par clients
            </button>
            <button
              onClick={() => setColorMode("ca")}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                colorMode === "ca" ? "bg-white text-green-700 shadow-sm font-medium" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Par CA
            </button>
          </div>
        </div>
      </div>

      {/* Map + Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative" style={{ minHeight: 0 }}>
          {loadingMap && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center z-10">
              <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          <ComposableMap
            projection="geoMercator"
            projectionConfig={{ center: [2.5, 46.5], scale: 2800 }}
            style={{ width: "100%", height: "100%" }}
          >
            <Geographies geography={GEO_URL}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const code = geo.properties.code as string;
                  const stat = deptMap.get(code);
                  const isSelected = selectedDept === code;
                  const color =
                    isSelected
                      ? "#1e3a8a"
                      : colorMode === "count"
                      ? getCountColor(stat?.count || 0, maxCount)
                      : getCAColor(stat?.totalCA || 0, maxCA);

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={color}
                      stroke="#ffffff"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: "none" },
                        hover: {
                          fill: isSelected ? "#1e3a8a" : colorMode === "count" ? "#93c5fd" : "#6ee7b7",
                          outline: "none",
                          cursor: "pointer",
                        },
                        pressed: { outline: "none" },
                      }}
                      onClick={() => {
                        setSelectedDept(code);
                        setSelectedDeptNom(geo.properties.nom as string);
                      }}
                      onMouseEnter={() => {
                        if (stat) setHoveredDept({ ...stat, nom: geo.properties.nom as string });
                        else setHoveredDept({ code, count: 0, totalCA: 0, categories: {}, etagereCount: 0, nom: geo.properties.nom as string });
                      }}
                      onMouseLeave={() => setHoveredDept(null)}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>

          {/* Legend */}
          <div className="absolute bottom-4 left-4 bg-white rounded-xl shadow-md px-3 py-3 text-xs select-none">
            <p className="font-semibold text-gray-700 mb-2">
              {colorMode === "count" ? "Nb clients / département" : "CA / département"}
            </p>
            {colorMode === "count" ? (
              <div className="space-y-1">
                {[
                  { color: "#e5e7eb", label: "0" },
                  { color: "#dbeafe", label: "Très peu" },
                  { color: "#60a5fa", label: "Moyen" },
                  { color: "#1d4ed8", label: "Beaucoup" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: l.color }} />
                    <span className="text-gray-500">{l.label}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1">
                {[
                  { color: "#e5e7eb", label: "0 €" },
                  { color: "#d1fae5", label: "Faible" },
                  { color: "#34d399", label: "Moyen" },
                  { color: "#047857", label: "Élevé" },
                ].map((l) => (
                  <div key={l.label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: l.color }} />
                    <span className="text-gray-500">{l.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tooltip */}
          {hoveredDept && (
            <div
              className="fixed z-50 bg-gray-900/95 text-white text-xs rounded-xl shadow-xl px-3 py-2.5 pointer-events-none"
              style={{ left: mousePos.x + 14, top: mousePos.y - 50 }}
            >
              <p className="font-semibold text-sm mb-1">
                {hoveredDept.nom}{" "}
                <span className="text-gray-400 font-normal">({hoveredDept.code})</span>
              </p>
              <p className="text-gray-300">{hoveredDept.count} client{hoveredDept.count > 1 ? "s" : ""}</p>
              <p className="text-gray-300">{fmt(hoveredDept.totalCA)} € CA</p>
              {hoveredDept.etagereCount > 0 && (
                <p className="text-amber-400">{hoveredDept.etagereCount} étagère{hoveredDept.etagereCount > 1 ? "s" : ""}</p>
              )}
            </div>
          )}
        </div>

        {/* Right panel */}
        <div
          className={`bg-white border-l flex flex-col overflow-hidden transition-all duration-300 ${
            selectedDept ? "w-80" : "w-0"
          }`}
        >
          {selectedDept && (
            <>
              {/* Panel header */}
              <div className="p-4 border-b flex-shrink-0">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="font-bold text-gray-900 text-base truncate">{selectedDeptNom}</h2>
                  <button
                    onClick={() => setSelectedDept(null)}
                    className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors flex-shrink-0 ml-2"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-xs text-gray-400">Département {selectedDept}</p>

                {selectedStat && (
                  <>
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      <div className="bg-blue-50 rounded-lg p-2 text-center">
                        <p className="text-blue-700 font-bold text-lg leading-none">{selectedStat.count}</p>
                        <p className="text-xs text-gray-400 mt-0.5">clients</p>
                      </div>
                      <div className="bg-green-50 rounded-lg p-2 text-center">
                        <p className="text-green-700 font-bold text-sm leading-none">
                          {selectedStat.totalCA >= 1000
                            ? `${(selectedStat.totalCA / 1000).toFixed(1)}k€`
                            : `${fmt(selectedStat.totalCA)}€`}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">CA</p>
                      </div>
                      <div className="bg-amber-50 rounded-lg p-2 text-center">
                        <p className="text-amber-700 font-bold text-lg leading-none">{selectedStat.etagereCount}</p>
                        <p className="text-xs text-gray-400 mt-0.5">étagères</p>
                      </div>
                    </div>

                    {/* Category breakdown */}
                    {Object.keys(selectedStat.categories).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1">
                        {Object.entries(selectedStat.categories)
                          .sort(([, a], [, b]) => b - a)
                          .map(([cat, cnt]) => (
                            <span
                              key={cat}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs text-white"
                              style={{ backgroundColor: CATEGORY_COLORS[cat] || "#6b7280" }}
                            >
                              {cnt} {cat}
                            </span>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Client list */}
              <div className="flex-1 overflow-y-auto">
                {loadingClients ? (
                  <div className="flex justify-center py-10">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : deptClients.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-10">Aucun client dans ce département</p>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 px-4 py-2 border-b bg-gray-50">
                      {deptClients.length} client{deptClients.length > 1 ? "s" : ""}
                    </p>
                    {deptClients.map((client) => (
                      <div key={client.id} className="px-4 py-3 border-b hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{client.nom}</p>
                            <p className="text-xs text-gray-400">
                              {client.codeClient}
                              {client.codePostal ? ` · ${client.codePostal}` : ""}
                            </p>
                            <p className="text-xs text-gray-400">{client.commercial?.name}</p>
                          </div>
                          <div className="flex-shrink-0 text-right">
                            {client.categorieStatut && (
                              <span
                                className="inline-block px-1.5 py-0.5 rounded text-xs text-white leading-snug"
                                style={{ backgroundColor: CATEGORY_COLORS[client.categorieStatut] || "#6b7280" }}
                              >
                                {client.categorieStatut}
                              </span>
                            )}
                            {client.etagere && (
                              <p className="text-xs text-amber-600 mt-0.5">étagère</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">{client._count.ventes} commande{client._count.ventes > 1 ? "s" : ""}</span>
                          {client.panierMoyen > 0 && (
                            <span className="text-xs text-gray-500">{fmt(client.panierMoyen)} €/cmd</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
