import React, { useState, useMemo } from "react";
import { getMediaUrl } from "../api/client";

export default function StoreExplorerPage({
  stores = [],
  loading = false,
  onSelectStore,
  customer,
  onOpenCustomerAuth,
  onOpenRegisterStore,
  onOpenOwnerLogin,
  onOpenSuperAdmin,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Filter categories
  const filterOptions = [
    { id: "ALL", label: "Toutes les Boutiques", icon: "storefront" },
    { id: "OUAGA", label: "🇧🇫 Ouagadougou", icon: "location_on" },
    { id: "BOBO", label: "🇧🇫 Bobo-Dioulasso", icon: "location_on" },
    { id: "FASHION", label: "Mode & Tissé", icon: "checkroom" },
    { id: "TECH", label: "High-Tech", icon: "devices" },
    { id: "BEAUTY", label: "Beauté & Bio", icon: "spa" },
  ];

  // Filtered stores
  const filteredStores = useMemo(() => {
    return stores.filter((st) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        st.name?.toLowerCase().includes(q) ||
        st.tagline?.toLowerCase().includes(q) ||
        st.description?.toLowerCase().includes(q) ||
        st.owner_name?.toLowerCase().includes(q) ||
        st.delivery_city?.toLowerCase().includes(q) ||
        st.slug?.toLowerCase().includes(q);

      if (!matchesSearch) return false;

      if (selectedFilter === "OUAGA") {
        return (st.delivery_city || "").toLowerCase().includes("ouaga");
      }
      if (selectedFilter === "BOBO") {
        return (st.delivery_city || "").toLowerCase().includes("bobo");
      }
      if (selectedFilter === "FASHION") {
        return (
          st.name?.toLowerCase().includes("danfani") ||
          st.name?.toLowerCase().includes("mode") ||
          st.tagline?.toLowerCase().includes("textile") ||
          st.tagline?.toLowerCase().includes("pagne")
        );
      }
      if (selectedFilter === "TECH") {
        return (
          st.name?.toLowerCase().includes("tech") ||
          st.name?.toLowerCase().includes("gadget") ||
          st.tagline?.toLowerCase().includes("smartphone") ||
          st.tagline?.toLowerCase().includes("tech")
        );
      }
      if (selectedFilter === "BEAUTY") {
        return (
          st.name?.toLowerCase().includes("beauté") ||
          st.name?.toLowerCase().includes("bio") ||
          st.name?.toLowerCase().includes("sya") ||
          st.tagline?.toLowerCase().includes("karité") ||
          st.tagline?.toLowerCase().includes("soin")
        );
      }

      return true;
    });
  }, [stores, searchQuery, selectedFilter]);

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(filteredStores.length / itemsPerPage));
  const paginatedStores = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredStores.slice(start, start + itemsPerPage);
  }, [filteredStores, currentPage, itemsPerPage]);

  const handlePageChange = (p) => {
    setCurrentPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-sans pb-28">
      {/* Platform Top Bar */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-xl border-b border-white/5 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-primary to-amber-500 text-on-primary flex items-center justify-center shadow-md">
              <span className="material-symbols-outlined text-2xl">storefront</span>
            </div>
            <div>
              <h1 className="font-extrabold text-base sm:text-lg tracking-tight text-on-surface leading-tight">
                GotoShop <span className="text-primary text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">Burkina &amp; Afrique</span>
              </h1>
              <p className="text-[11px] text-on-surface-variant hidden xs:block">
                Le réseau des commerçants certifiés sans intermédiaire
              </p>
            </div>
          </div>

          {/* Unified Customer Profile / Login */}
          <div className="flex items-center gap-2">
            {customer ? (
              <div className="flex items-center gap-2 bg-surface-container-high/80 border border-primary/20 px-3 py-1.5 rounded-full">
                <div className="w-7 h-7 rounded-full bg-primary text-on-primary flex items-center justify-center text-xs font-bold ring-1 ring-primary/40">
                  {customer.name ? customer.name.charAt(0).toUpperCase() : "C"}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="text-xs font-bold text-on-surface leading-none">{customer.name}</p>
                  <p className="text-[10px] text-secondary leading-tight">Compte Actif Partout</p>
                </div>
              </div>
            ) : (
              <button
                onClick={onOpenCustomerAuth}
                className="px-3.5 py-2 rounded-full bg-primary text-on-primary text-xs font-bold shadow-md hover:brightness-105 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">bolt</span>
                <span>Connexion Rapide</span>
              </button>
            )}

            <button
              onClick={onOpenRegisterStore}
              className="hidden md:flex px-3.5 py-2 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface text-xs font-bold border border-white/10 transition-all items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px] text-amber-400">add_business</span>
              <span>Ouvrir ma boutique</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Exploration Banner */}
      <section className="px-4 pt-6 pb-4 max-w-4xl mx-auto w-full">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface-container-high via-surface-container to-surface-container-lowest p-6 sm:p-8 border border-white/5 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none -mr-16 -mt-16" />
          <div className="relative z-10 space-y-3 max-w-xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/15 text-secondary text-xs font-bold border border-secondary/30">
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
              <span>Boutiques Ouvertes &amp; Vendeurs Disponibles</span>
            </div>
            <h2 className="font-headline-sm text-2xl sm:text-3xl font-black text-on-surface tracking-tight leading-snug">
              Découvrez les meilleures boutiques du Burkina Faso.
            </h2>
            <p className="font-body-md text-xs sm:text-sm text-on-surface-variant leading-relaxed">
              Commandez directement sur WhatsApp ou Messenger avec paiement à la livraison. Votre compte client est unique et reconnu sur toutes les boutiques.
            </p>
          </div>

          {/* Platform Trust Highlights */}
          <div className="grid grid-cols-3 gap-2 pt-6 mt-4 border-t border-white/5 text-center">
            <div className="space-y-0.5">
              <p className="font-bold text-sm sm:text-base text-primary">100% Direct</p>
              <p className="text-[10px] sm:text-xs text-on-surface-variant">Zéro intermédiaire</p>
            </div>
            <div className="space-y-0.5 border-x border-white/10">
              <p className="font-bold text-sm sm:text-base text-secondary">À la livraison</p>
              <p className="text-[10px] sm:text-xs text-on-surface-variant">Paiement après vérification</p>
            </div>
            <div className="space-y-0.5">
              <p className="font-bold text-sm sm:text-base text-amber-400">1 Seul Compte</p>
              <p className="text-[10px] sm:text-xs text-on-surface-variant">Reconnu partout</p>
            </div>
          </div>
        </div>
      </section>

      {/* Search & Filter Bar */}
      <section className="px-4 py-3 max-w-4xl mx-auto w-full space-y-3">
        {/* Search Input */}
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3.5 top-3.5 text-on-surface-variant text-[20px]">
            search
          </span>
          <input
            type="text"
            placeholder="Rechercher une boutique, un créateur, un produit, une ville..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-12 pl-11 pr-10 rounded-2xl bg-surface-container-high border border-white/10 text-on-surface placeholder:text-on-surface-variant/50 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-sm transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-3.5 w-5 h-5 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center hover:text-on-surface"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          )}
        </div>

        {/* Quick Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {filterOptions.map((f) => (
            <button
              key={f.id}
              onClick={() => {
                setSelectedFilter(f.id);
                setCurrentPage(1);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                selectedFilter === f.id
                  ? "bg-primary text-on-primary shadow-md scale-102"
                  : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant border border-white/5"
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">{f.icon}</span>
              <span>{f.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Boutiques Cards Grid */}
      <main className="px-4 py-2 max-w-4xl mx-auto w-full flex-1">
        {loading ? (
          <div className="text-center py-20 space-y-3">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-on-surface-variant">Chargement des boutiques partenaires...</p>
          </div>
        ) : paginatedStores.length === 0 ? (
          <div className="text-center py-16 px-4 bg-surface-container rounded-3xl border border-white/5 space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-surface-container-highest text-on-surface-variant flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">storefront</span>
            </div>
            <h3 className="font-bold text-base text-on-surface">Aucune boutique trouvée</h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
              Aucun résultat pour "{searchQuery}". Essayez un autre mot-clé ou réinitialisez les filtres.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedFilter("ALL");
              }}
              className="px-4 py-2 rounded-xl bg-primary/15 text-primary text-xs font-bold hover:bg-primary/25 transition-colors"
            >
              Voir toutes les boutiques
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedStores.map((st, idx) => {
              const primaryCol = st.primary_color || "#ec761e";

              return (
                <div
                  key={st.id}
                  onClick={() => onSelectStore(st.slug)}
                  className="group relative bg-surface-container rounded-3xl border border-white/5 overflow-hidden shadow-md hover:shadow-2xl hover:border-primary/40 transition-all duration-300 cursor-pointer flex flex-col justify-between"
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  {/* Top Decorative Banner */}
                  <div
                    className="h-20 w-full relative overflow-hidden flex items-end p-3 transition-transform group-hover:scale-102 duration-300"
                    style={{
                      background: `linear-gradient(135deg, ${primaryCol}33 0%, ${primaryCol}11 100%)`,
                    }}
                  >
                    <div
                      className="absolute -right-6 -bottom-6 w-24 h-24 rounded-full blur-xl opacity-40"
                      style={{ backgroundColor: primaryCol }}
                    />
                    <div className="flex items-center justify-between w-full relative z-10">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface/80 backdrop-blur-md text-on-surface flex items-center gap-1 shadow-sm border border-white/10">
                        <span className="material-symbols-outlined text-[13px] text-secondary">location_on</span>
                        <span>{st.delivery_city?.split("(")[0]?.trim() || "Burkina Faso"}</span>
                      </span>

                      <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-secondary/20 text-secondary border border-secondary/30 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
                        <span>{st.social_tunnel_badge || "WA/FB"}</span>
                      </span>
                    </div>
                  </div>

                  {/* Boutique Identity Card Body */}
                  <div className="p-4 sm:p-5 pt-0 space-y-3 relative flex-1 flex flex-col justify-between">
                    {/* Floating Avatar & Logo Row */}
                    <div className="flex items-end justify-between -mt-8">
                      {/* Store Logo */}
                      <div className="relative">
                        <div
                          className="w-14 h-14 rounded-2xl p-0.5 bg-surface border-2 shadow-lg overflow-hidden flex items-center justify-center shrink-0"
                          style={{ borderColor: primaryCol }}
                        >
                          <img
                            src={getMediaUrl(st.logo_url) || "/media/store/logo.jpg"}
                            alt={st.name}
                            className="w-full h-full object-cover rounded-xl"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "/media/store/logo.jpg";
                            }}
                          />
                        </div>
                        {st.is_verified && (
                          <span
                            className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-secondary text-surface flex items-center justify-center shadow-md"
                            title="Boutique vérifiée"
                          >
                            <span className="material-symbols-outlined text-[13px] font-bold">verified</span>
                          </span>
                        )}
                      </div>

                      {/* Owner Portrait & Identity */}
                      {st.owner_name && (
                        <div className="flex items-center gap-2 bg-surface/80 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/10 shadow-sm">
                          <img
                            src={getMediaUrl(st.avatar_url) || "/media/store/awa_portrait.jpg"}
                            alt={st.owner_name}
                            className="w-6 h-6 rounded-full object-cover ring-1 ring-primary"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "/media/store/awa_portrait.jpg";
                            }}
                          />
                          <div className="text-left">
                            <span className="text-[11px] font-bold text-on-surface block leading-tight truncate max-w-[110px]">
                              {st.owner_name}
                            </span>
                            <span className="text-[9px] text-on-surface-variant block leading-none">Gérant(e)</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Name & Tagline */}
                    <div className="space-y-1 pt-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-headline-sm text-base sm:text-lg font-extrabold text-on-surface group-hover:text-primary transition-colors truncate">
                          {st.name}
                        </h3>
                        {/* Rating Stars */}
                        <div className="flex items-center gap-1 shrink-0 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full text-amber-400 text-xs font-bold">
                          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                            star
                          </span>
                          <span>{st.rating || 4.9}</span>
                        </div>
                      </div>

                      <p className="text-xs text-on-surface-variant font-medium line-clamp-2 leading-relaxed">
                        {st.tagline || st.description || "Articles authentiques et service client direct."}
                      </p>
                    </div>

                    {/* Metrics / Highlights */}
                    <div className="flex items-center justify-between text-[11px] text-on-surface-variant pt-2 border-t border-white/5">
                      <div className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[15px] text-primary">inventory_2</span>
                        <span>{st.products_count || 4} articles en vitrine</span>
                      </div>
                      <div className="flex items-center gap-1 font-mono text-secondary">
                        <span className="material-symbols-outlined text-[15px]">verified</span>
                        <span>Paiement Livraison</span>
                      </div>
                    </div>

                    {/* CTA Enter Boutique Button */}
                    <div className="pt-2">
                      <button
                        type="button"
                        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all duration-200 group-hover:brightness-110 shadow-sm"
                        style={{
                          backgroundColor: primaryCol,
                          color: "#ffffff",
                        }}
                      >
                        <span>Entrer dans la boutique</span>
                        <span className="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">
                          arrow_forward
                        </span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-8 pb-4">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high disabled:opacity-40 text-xs font-bold flex items-center gap-1 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              <span>Précédent</span>
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => handlePageChange(p)}
                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${
                  currentPage === p
                    ? "bg-primary text-on-primary shadow-md scale-105"
                    : "bg-surface-container hover:bg-surface-container-high text-on-surface-variant"
                }`}
              >
                {p}
              </button>
            ))}

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high disabled:opacity-40 text-xs font-bold flex items-center gap-1 transition-all"
            >
              <span>Suivant</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </button>
          </div>
        )}
      </main>

      {/* Footer / Links */}
      <footer className="mt-8 pt-6 border-t border-white/5 text-center text-xs text-on-surface-variant max-w-4xl mx-auto w-full px-4 space-y-2">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button onClick={onOpenRegisterStore} className="text-amber-400 hover:underline font-semibold">
            Inscrire ma boutique
          </button>
          <span>•</span>
          <button onClick={onOpenOwnerLogin} className="hover:underline">
            Accès Gérant
          </button>
          <span>•</span>
          <button onClick={onOpenSuperAdmin} className="hover:underline">
            Console Plateforme
          </button>
        </div>
        <p className="text-[11px] opacity-70">
          GotoShop • Plateforme de commerce conversationnel multi-boutiques pour l'Afrique de l'Ouest.
        </p>
      </footer>
    </div>
  );
}
