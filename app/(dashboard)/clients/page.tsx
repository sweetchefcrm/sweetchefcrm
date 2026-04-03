"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import ClientsTable, { Client } from "@/components/clients/ClientsTable";
import ClientFilters from "@/components/clients/ClientFilters";
import { Loader2 } from "lucide-react";
import { Role } from "@prisma/client";

const EDIT_ROLES: string[] = [Role.ADMIN, Role.CHEF_TERRAIN, Role.CHEF_TELEVENTE];

interface ClientsResponse {
  clients: Client[];
  total: number;
  page: number;
  totalPages: number;
}

export default function ClientsPage() {
  const { data: session } = useSession();
  const [data, setData] = useState<ClientsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [villes, setVilles] = useState<string[]>([]);
  const [categorieTypes, setCategorieTypes] = useState<string[]>([]);
  const [sousCategories, setSousCategories] = useState<string[]>([]);
  const [commerciaux, setCommercaux] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/clients/options")
      .then((r) => r.json())
      .then((d) => {
        setVilles(d.villes || []);
        setCategorieTypes(d.types || []);
        setSousCategories(d.sousCategories || []);
        setCommercaux(d.commerciaux || []);
      });
  }, []);

  // Filtres rapides
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  // Tri
  const [sortBy, setSortBy] = useState("nom");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  // Filtres avancés
  const [etagereFilter, setEtagereFilter] = useState("");
  const [villeFilter, setVilleFilter] = useState("");
  const [categorieStatutFilter, setCategorieStatutFilter] = useState("");
  const [sousCategorieFilter, setSousCategorieFilter] = useState("");
  const [categorieTypeFilter, setCategorieTypeFilter] = useState("");
  const [commercialFilter, setCommercialFilter] = useState("");

  const canEdit = session ? EDIT_ROLES.includes(session.user.role) : false;
  const isAdmin = session?.user.role === Role.ADMIN;

  const fetchClients = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      filter,
      search,
      page: String(page),
      sortBy,
      sortOrder,
      etagere: etagereFilter,
      ville: villeFilter,
      categorieStatut: categorieStatutFilter,
      sousCategorie: sousCategorieFilter,
      categorieType: categorieTypeFilter,
      commercial: commercialFilter,
    });
    const res = await fetch(`/api/clients?${params}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [filter, search, page, sortBy, sortOrder, etagereFilter, villeFilter, categorieStatutFilter, sousCategorieFilter, categorieTypeFilter, commercialFilter]);

  useEffect(() => {
    const t = setTimeout(fetchClients, 300);
    return () => clearTimeout(t);
  }, [fetchClients]);

  function resetPage() { setPage(1); }

  function handleFilterChange(f: string) { setFilter(f); resetPage(); }
  function handleSearchChange(s: string) { setSearch(s); resetPage(); }

  function handleSortBy(field: string) {
    if (sortBy === field) setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    else { setSortBy(field); setSortOrder("asc"); }
    resetPage();
  }

  function handleReset() {
    setFilter("all");
    setSearch("");
    setEtagereFilter("");
    setVilleFilter("");
    setCategorieStatutFilter("");
    setSousCategorieFilter("");
    setCategorieTypeFilter("");
    setCommercialFilter("");
    setSortBy("nom");
    setSortOrder("asc");
    resetPage();
  }

  function handleClientUpdated(updated: Client) {
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        clients: prev.clients.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)),
      };
    });
  }

  return (
    <div className="p-6 space-y-5">
      <Header title="Clients" subtitle="Liste et suivi de vos clients" />

      <ClientFilters
        filter={filter}
        search={search}
        sortBy={sortBy}
        sortOrder={sortOrder}
        etagereFilter={etagereFilter}
        villeFilter={villeFilter}
        categorieStatutFilter={categorieStatutFilter}
        sousCategorieFilter={sousCategorieFilter}
        categorieTypeFilter={categorieTypeFilter}
        commercialFilter={commercialFilter}
        villes={villes}
        categorieTypes={categorieTypes}
        sousCategories={sousCategories}
        commerciaux={commerciaux}
        onFilterChange={handleFilterChange}
        onSearchChange={handleSearchChange}
        onSortByChange={(f) => { setSortBy(f); resetPage(); }}
        onSortOrderToggle={() => { setSortOrder((o) => (o === "asc" ? "desc" : "asc")); resetPage(); }}
        onEtagereFilterChange={(v) => { setEtagereFilter(v); resetPage(); }}
        onVilleFilterChange={(v) => { setVilleFilter(v); resetPage(); }}
        onCategorieStatutChange={(v) => { setCategorieStatutFilter(v); resetPage(); }}
        onSousCategorieChange={(v) => { setSousCategorieFilter(v); resetPage(); }}
        onCategorieTypeChange={(v) => { setCategorieTypeFilter(v); resetPage(); }}
        onCommercialFilterChange={(v) => { setCommercialFilter(v); resetPage(); }}
        onReset={handleReset}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-7 h-7 animate-spin text-[#1E40AF]" />
        </div>
      ) : (
        <ClientsTable
          clients={data?.clients || []}
          total={data?.total || 0}
          page={page}
          totalPages={data?.totalPages || 1}
          onPageChange={setPage}
          canEdit={canEdit}
          isAdmin={isAdmin}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={handleSortBy}
          onClientUpdated={handleClientUpdated}
        />
      )}
    </div>
  );
}
