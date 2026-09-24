import Icon from "./Icon";
import React, { useState, useMemo } from "react";
import { getMediaUrl } from "../api/client";
import ThemeToggle from "./ThemeToggle";
import Footer from "./Footer";

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
  const itemsPerPage = 12;

  // Filter categories
  const filterOptions = [
    { id: "ALL", label: "Toutes les Boutiques", icon: "storefront" },
    { id: "BURKINA", label: "Burkina Faso 🇧🇫", icon: "location_on" },
    { id: "CI", label: "Côte d'Ivoire 🇨🇮", icon: "location_on" },
    { id: "MALI", label: "Mali 🇲🇱", icon: "location_on" },
    { id: "SENEGAL", label: "Sénégal 🇸🇳", icon: "location_on" },
    { id: "TOGO_BENIN", label: "Togo & Bénin 🇹🇬 🇧🇯", icon: "location_on" },
    { id: "DIASPORA", label: "Diaspora & Monde 🌍", icon: "public" },
    { id: "FASHION", label: "Mode & Faso Danfani", icon: "checkroom" },
    { id: "TECH", label: "High-Tech & Gadgets", icon: "devices" },
    { id: "BEAUTY", label: "Cosmétique & Soins Bio", icon: "spa" },
    { id: "FOOD", label: "Terroir & Épicerie", icon: "restaurant" },
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

      const cityLower = (st.delivery_city || "").toLowerCase();
      const nameLower = (st.name || "").toLowerCase();
      const tagLower = (st.tagline || "").toLowerCase();

      if (selectedFilter === "BURKINA") {
        return (
          st.country === "BF" ||
          cityLower.includes("ouaga") ||
          cityLower.includes("bobo") ||
          cityLower.includes("koudougou") ||
          cityLower.includes("kaya") ||
          cityLower.includes("banfora") ||
          cityLower.includes("dédougou") ||
          cityLower.includes("fada") ||
          cityLower.includes("burkina")
        );
      }
      if (selectedFilter === "CI") {
        return st.country === "CI" || cityLower.includes("abidjan") || cityLower.includes("yamoussoukro") || cityLower.includes("ivoire");
      }
      if (selectedFilter === "MALI") {
        return st.country === "ML" || cityLower.includes("bamako") || cityLower.includes("ségou") || cityLower.includes("mali");
      }
      if (selectedFilter === "SENEGAL") {
        return st.country === "SN" || cityLower.includes("dakar") || cityLower.includes("sénégal");
      }
      if (selectedFilter === "TOGO_BENIN") {
        return st.country === "TG" || st.country === "BJ" || cityLower.includes("lomé") || cityLower.includes("cotonou") || cityLower.includes("togo") || cityLower.includes("bénin");
      }
      if (selectedFilter === "DIASPORA") {
        return st.country === "DIASPORA" || cityLower.includes("paris") || cityLower.includes("bruxelles") || cityLower.includes("montréal") || cityLower.includes("france") || cityLower.includes("europe");
      }
      if (selectedFilter === "FASHION") {
        return (
          st.category === "FASHION" ||
          nameLower.includes("danfani") ||
          nameLower.includes("mode") ||
          nameLower.includes("pagne") ||
          nameLower.includes("couture") ||
          nameLower.includes("chaussures") ||
          nameLower.includes("kôkô") ||
          tagLower.includes("textile") ||
          tagLower.includes("pagne")
        );
      }
      if (selectedFilter === "TECH") {
        return (
          st.category === "TECH" ||
          nameLower.includes("tech") ||
          nameLower.includes("gadget") ||
          nameLower.includes("solaire") ||
          nameLower.includes("smartphone") ||
          nameLower.includes("accessoire")
        );
      }
      if (selectedFilter === "BEAUTY") {
        return (
          st.category === "BEAUTY" ||
          nameLower.includes("beauté") ||
          nameLower.includes("soin") ||
          nameLower.includes("savon") ||
          nameLower.includes("karité") ||
          nameLower.includes("cosmétique") ||
          tagLower.includes("karité") ||
          tagLower.includes("naturel")
        );
      }
      if (selectedFilter === "FOOD") {
        return (
          st.category === "FOOD" ||
          nameLower.includes("miel") ||
          nameLower.includes("fonio") ||
          nameLower.includes("épicerie") ||
          nameLower.includes("saveurs") ||
          nameLower.includes("nectar") ||
          nameLower.includes("sirop") ||
          tagLower.includes("miel") ||
          tagLower.includes("épice")
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
    const elem = document.getElementById("stores-directory");
    if (elem) elem.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-sans pb-24 transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-subtle px-4 sm:px-6">
        <div className="max-w-5xl mx-auto h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary text-white flex items-center justify-center font-bold shadow-sm">
              <Icon name="storefront" className="text-[20px]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-base sm:text-lg text-on-surface tracking-tight">GotoShop</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-surface-secondary text-on-surface-variant border border-subtle">
                  Afrique de l'Ouest
                </span>
              </div>
            </div>
          </div>

          {/* User Auth & Actions */}
          <div className="flex items-center gap-2">
            {customer ? (
              <div className="flex items-center gap-2 bg-surface-secondary border border-subtle px-3 py-1.5 rounded-xl">
                <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-bold">
                  {customer.name ? customer.name.charAt(0).toUpperCase() : "C"}
                </div>
                <span className="text-xs font-medium text-on-surface hidden sm:inline max-w-[120px] truncate">
                  {customer.name}
                </span>
              </div>
            ) : (
              <button
                onClick={onOpenCustomerAuth}
                className="h-8 px-3 rounded-xl bg-surface-secondary hover:bg-surface-container-highest text-on-surface text-xs font-medium border border-subtle transition-all flex items-center gap-1.5"
              >
                <Icon name="login" className="text-[15px] text-primary" />
                <span>Connexion</span>
              </button>
            )}

            <button
              onClick={onOpenRegisterStore}
              className="h-8 px-3 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1.5"
            >
              <Icon name="add_business" className="text-[15px]" />
              <span className="hidden xs:inline">Ouvrir ma boutique</span>
            </button>

            {/* Theme Toggle in Explorer */}
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="px-4 sm:px-6 pt-6 sm:pt-10 pb-6 max-w-5xl mx-auto w-full">
        <div className="relative overflow-hidden rounded-3xl border border-subtle bg-surface-container p-6 sm:p-10 shadow-card">
          {/* Subtle Photographic Overlay */}
          <div className="absolute inset-0 pointer-events-none">
            <img
              src="https://images.unsplash.com/photo-1544816155-12df9643f363?w=1600&auto=format&fit=crop&q=80"
              alt="Boutiques d'Afrique"
              className="w-full h-full object-cover opacity-15 dark:opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-r from-surface-container via-surface-container/95 to-surface-container/80" />
          </div>

          <div className="relative z-10 space-y-4 max-w-2xl">
            {/* Eyebrow Label */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              <span>Commerce Conversationnel &amp; Boutiques Locales</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold text-on-surface tracking-tight leading-[1.15]">
              Découvrez, commandez et échangez avec vos boutiques préférées.
            </h1>

            {/* Short Paragraph (max 65-75 chars per line) */}
            <p className="text-sm sm:text-base text-on-surface-secondary leading-relaxed max-w-xl">
              Accédez aux vitrines locales, consultez les catalogues et menus, discutez en direct et commandez en toute confiance.
            </p>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <a
                href="#stores-directory"
                className="h-11 px-5 rounded-xl bg-primary hover:brightness-105 text-white text-sm font-semibold flex items-center gap-2 shadow-sm transition-all active:scale-[0.98]"
              >
                <span>Explorer les boutiques</span>
                <Icon name="arrow_downward" className="text-[18px]" />
              </a>

              <button
                onClick={onOpenRegisterStore}
                className="h-11 px-5 rounded-xl bg-surface-secondary hover:bg-surface-container-highest text-on-surface text-sm font-medium border border-subtle transition-all flex items-center gap-2"
              >
                <Icon name="store" className="text-[18px] text-amber-500" />
                <span>Créer ma boutique</span>
              </button>
            </div>
          </div>

          {/* Three Pillar Guarantees */}
          <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 pt-6 mt-6 border-t border-subtle">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-secondary/60 border border-subtle">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon name="chat" className="text-[18px]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">100% Direct</p>
                <p className="text-xs text-on-surface-variant">Messagerie intégrée &amp; canaux directs</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-secondary/60 border border-subtle">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center shrink-0">
                <Icon name="verified_user" className="text-[18px]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">À la livraison</p>
                <p className="text-xs text-on-surface-variant">Vérifiez vos articles avant de régler</p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-secondary/60 border border-subtle">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
                <Icon name="badge" className="text-[18px]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-on-surface">Compte Unifié</p>
                <p className="text-xs text-on-surface-variant">Vos commandes et boutiques au même endroit</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Directory Section Anchor */}
      <section id="stores-directory" className="px-4 sm:px-6 pt-4 pb-2 max-w-5xl mx-auto w-full space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Icon name="search" className="absolute left-3.5 top-3.5 text-slate-400 text-[19px]" />
          <input
            type="text"
            placeholder="Rechercher une boutique par nom, gérant, spécialité ou ville..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full h-11 pl-10 pr-10 rounded-xl bg-surface border border-subtle text-on-surface placeholder:text-on-surface-variant text-sm focus:outline-none focus:border-primary transition-all shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-3 w-5 h-5 rounded-full bg-surface-secondary text-on-surface-variant flex items-center justify-center hover:text-on-surface"
            >
              <Icon name="close" className="text-[14px]" />
            </button>
          )}
        </div>

        {/* Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {filterOptions.map((f) => {
            const isActive = selectedFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => {
                  setSelectedFilter(f.id);
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-primary text-white font-semibold shadow-sm"
                    : "bg-surface-secondary text-on-surface-variant hover:text-on-surface border border-subtle"
                }`}
              >
                <Icon name={f.icon} className="text-[15px]" />
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>

        {/* Results Counter */}
        <div className="flex items-center justify-between text-xs text-on-surface-variant px-1 pt-1">
          <span>
            {filteredStores.length} boutique{filteredStores.length > 1 ? "s" : ""} disponible{filteredStores.length > 1 ? "s" : ""}
          </span>
          <span className="flex items-center gap-1 text-on-surface-variant">
            <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
            Vendeurs en ligne
          </span>
        </div>
      </section>

      {/* Boutiques Cards Grid */}
      <main className="px-4 sm:px-6 py-2 max-w-5xl mx-auto w-full flex-1">
        {loading ? (
          <div className="text-center py-20 space-y-3">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-on-surface-variant">Chargement des boutiques partenaires...</p>
          </div>
        ) : paginatedStores.length === 0 ? (
          <div className="text-center py-16 px-4 bg-surface-container rounded-2xl border border-subtle space-y-3 shadow-card">
            <div className="w-12 h-12 rounded-xl bg-surface-secondary text-on-surface-variant flex items-center justify-center mx-auto">
              <Icon name="storefront" className="text-2xl" />
            </div>
            <h3 className="font-semibold text-base text-on-surface">Aucune boutique trouvée</h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
              Aucun résultat pour "{searchQuery}". Modifiez vos termes de recherche ou réinitialisez les filtres.
            </p>
            <button
              onClick={() => {
                setSearchQuery("");
                setSelectedFilter("ALL");
              }}
              className="px-4 py-2 rounded-xl bg-surface-secondary hover:bg-surface-container-highest text-on-surface text-xs font-medium border border-subtle transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paginatedStores.map((st) => {
              return (
                <div
                  key={st.id}
                  onClick={() => onSelectStore(st.slug)}
                  className="group relative bg-surface-container rounded-2xl border-2 border-slate-200 dark:border-slate-800 hover:border-primary/60 transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden shadow-card hover:shadow-card-hover"
                >
                  <div className="p-5 space-y-4">
                    {/* Top Identity Row */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Store Logo */}
                        <div className="relative shrink-0">
                          <img
                            src={getMediaUrl(st.logo_url) || "/media/store/logo.jpg"}
                            alt=""
                            className="w-12 h-12 rounded-xl object-cover border-2 border-slate-200 dark:border-slate-700 bg-surface shadow-xs"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = "/media/store/logo.jpg";
                            }}
                          />
                          {st.is_verified && (
                            <span
                              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-secondary text-white flex items-center justify-center text-[10px] font-bold shadow ring-2 ring-surface select-none"
                              title="Boutique vérifiée GotoShop"
                            >
                              <Icon name="check" className="text-[10px]" aria-hidden="true" />
                            </span>
                          )}
                        </div>

                        {/* Title & Location */}
                        <div className="min-w-0">
                          <h3 className="font-semibold text-base text-on-surface group-hover:text-primary transition-colors truncate">
                            {st.name}
                          </h3>
                          <div className="flex items-center gap-1.5 text-xs text-on-surface-variant mt-0.5 truncate">
                            <span className="flex items-center gap-0.5">
                              <Icon name="location_on" className="text-[13px] text-secondary" aria-hidden="true" />
                              <span>{st.delivery_city?.split("(")[0]?.trim() || "Burkina Faso"}</span>
                            </span>
                            {st.owner_name && (
                              <>
                                <span>•</span>
                                <span className="truncate">{st.owner_name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Star Rating Badge */}
                      <div className="flex items-center gap-1 shrink-0 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-500 text-xs font-semibold">
                        <Icon name="star" className="text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }} aria-hidden="true" />
                        <span>{st.rating || 4.9}</span>
                      </div>
                    </div>

                    {/* Tagline / Activity */}
                    <p className="text-xs text-on-surface-secondary line-clamp-2 leading-relaxed font-normal">
                      {st.tagline || st.description || "Catalogue de qualité avec commande directe et remise en main propre."}
                    </p>
                  </div>

                  {/* Card Action Footer (Dual-Tone Superimposed Bar) */}
                  <div className="px-5 py-3 border-t-2 border-slate-200 dark:border-slate-800 bg-surface-secondary/80 flex items-center justify-between text-xs">
                    <span className="text-on-surface-variant font-medium">
                      Paiement à la livraison
                    </span>
                    <span className="text-primary font-semibold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      <span>Visiter la vitrine</span>
                      <Icon name="arrow_forward" className="text-[14px]" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Clean Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-8 pb-4">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl bg-surface-secondary hover:bg-surface-container-highest disabled:opacity-40 text-xs font-medium text-on-surface flex items-center gap-1 transition-all border border-subtle"
            >
              <Icon name="chevron_left" className="text-[15px]" />
              <span>Précédent</span>
            </button>

            <span className="text-xs text-on-surface-variant px-2">
              Page {currentPage} sur {totalPages}
            </span>

            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-xl bg-surface-secondary hover:bg-surface-container-highest disabled:opacity-40 text-xs font-medium text-on-surface flex items-center gap-1 transition-all border border-subtle"
            >
              <span>Suivant</span>
              <Icon name="chevron_right" className="text-[15px]" />
            </button>
          </div>
        )}
      </main>

      {/* Platform Navigation Links & Branded Footer */}
      <div className="mt-8 pt-4 text-center text-xs text-on-surface-variant max-w-5xl mx-auto w-full px-4">
        <div className="flex items-center justify-center gap-4 flex-wrap">
          <button onClick={onOpenRegisterStore} className="text-primary hover:underline font-semibold cursor-pointer">
            Ouvrir ma boutique
          </button>
          <span>•</span>
          <button onClick={onOpenOwnerLogin} className="hover:text-on-surface transition-colors cursor-pointer">
            Espace Commerçant
          </button>
          <span>•</span>
          <button onClick={onOpenSuperAdmin} className="hover:text-on-surface transition-colors cursor-pointer">
            Console Plateforme
          </button>
        </div>
      </div>

      <Footer />
    </div>
  );
}
