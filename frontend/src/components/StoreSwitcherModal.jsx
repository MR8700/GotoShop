import React, { useState, useEffect } from "react";
import { fetchPublicStores, getActiveStoreSlug, setActiveStoreSlug, getMediaUrl } from "../api/client";

export default function StoreSwitcherModal({ isOpen, onClose, onSelectStore, onOpenSuperAdmin, onOpenExplorer }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const activeSlug = getActiveStoreSlug();

  useEffect(() => {
    if (isOpen) {
      loadStores();
      setSearchQuery("");
    }
  }, [isOpen]);

  const loadStores = async () => {
    try {
      setLoading(true);
      const list = await fetchPublicStores();
      setStores(list);
    } catch (e) {
      console.error("Error loading stores:", e);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredStores = stores.filter((st) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      st.name?.toLowerCase().includes(q) ||
      st.owner_name?.toLowerCase().includes(q) ||
      st.delivery_city?.toLowerCase().includes(q) ||
      st.country?.toLowerCase().includes(q) ||
      st.tagline?.toLowerCase().includes(q) ||
      st.description?.toLowerCase().includes(q)
    );
  });

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-fade-in"
    >
      <div className="w-full max-w-2xl bg-surface-container-high border border-white/10 rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between bg-surface-container/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/15 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-2xl">storefront</span>
            </div>
            <div>
              <h3 className="font-extrabold text-on-surface text-base sm:text-lg">Changer de Boutique</h3>
              <p className="text-xs text-on-surface-variant">
                Explorez nos boutiques partenaires au Burkina Faso et en Afrique
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-container-highest text-on-surface-variant hover:text-on-surface flex items-center justify-center transition-transform active:scale-95"
            aria-label="Fermer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-white/5 bg-surface-container-high/40 shrink-0 space-y-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-3 text-on-surface-variant text-[19px]">
              search
            </span>
            <input
              type="text"
              placeholder="Rechercher une boutique par nom, ville, spécialité..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-surface-container border border-white/10 text-on-surface placeholder:text-on-surface-variant/50 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary shadow-inner"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 w-5 h-5 rounded-full bg-surface-container-highest text-on-surface-variant flex items-center justify-center hover:text-on-surface text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-[11px] text-on-surface-variant px-1">
            <span>
              {filteredStores.length} boutique{filteredStores.length > 1 ? "s" : ""} disponible{filteredStores.length > 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1 text-secondary font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              Commande directe WhatsApp
            </span>
          </div>
        </div>

        {/* Stores Cards Grid */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          {loading ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-on-surface-variant">Chargement des boutiques...</p>
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="text-center py-12 px-4 bg-surface-container rounded-2xl border border-white/5 space-y-2">
              <span className="material-symbols-outlined text-3xl text-on-surface-variant">storefront</span>
              <p className="font-bold text-sm text-on-surface">Aucune boutique trouvée</p>
              <p className="text-xs text-on-surface-variant">
                Aucun résultat pour "{searchQuery}". Essayez un autre mot-clé.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredStores.map((st) => {
                const isSelected = activeSlug === st.slug || (!activeSlug && st.slug === "faso-danfani");
                const primaryCol = st.primary_color || "#ec761e";

                return (
                  <div
                    key={st.id}
                    onClick={() => {
                      setActiveStoreSlug(st.slug);
                      if (onSelectStore) onSelectStore(st.slug);
                      onClose();
                    }}
                    className={`relative p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-3 group ${
                      isSelected
                        ? "bg-primary/10 border-primary/50 shadow-md ring-1 ring-primary/30"
                        : "bg-surface-container hover:bg-surface-container-highest/80 border-white/5 hover:border-white/20"
                    }`}
                  >
                    {/* Top row: Logo, Identity, Rating */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div
                          className="w-12 h-12 rounded-xl overflow-hidden border flex items-center justify-center font-bold text-white shadow-sm bg-surface-container-highest"
                          style={{ borderColor: primaryCol }}
                        >
                          {st.logo_url ? (
                            <img
                              src={getMediaUrl(st.logo_url)}
                              alt={st.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.onerror = null;
                                e.target.style.display = "none";
                              }}
                            />
                          ) : (
                            <span style={{ color: primaryCol }}>{st.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        {st.is_verified && (
                          <span
                            className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-secondary text-surface flex items-center justify-center text-[10px] font-bold shadow"
                            title="Boutique vérifiée"
                          >
                            ✓
                          </span>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-bold text-on-surface text-xs sm:text-sm truncate group-hover:text-primary transition-colors">
                            {st.name}
                          </h4>
                          {/* Rating */}
                          <span className="shrink-0 flex items-center gap-0.5 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md">
                            ★ {st.rating || 4.9}
                          </span>
                        </div>

                        {/* Owner & City */}
                        <div className="flex items-center gap-1.5 text-[11px] text-on-surface-variant mt-0.5 truncate">
                          {st.owner_name && (
                            <>
                              <span className="font-medium text-slate-300 truncate max-w-[90px]">
                                {st.owner_name}
                              </span>
                              <span>•</span>
                            </>
                          )}
                          <span className="truncate flex items-center gap-0.5">
                            <span className="material-symbols-outlined text-[12px] text-secondary">location_on</span>
                            {st.delivery_city?.split("(")[0]?.trim() || "Burkina Faso"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Tagline / Activity in a few words */}
                    <p className="text-[11px] text-on-surface-variant/90 line-clamp-2 leading-relaxed">
                      {st.tagline || st.description || "Boutique en ligne avec commande directe WhatsApp et paiement à la livraison."}
                    </p>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
                      {isSelected ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-primary text-on-primary flex items-center gap-1">
                          <span>✓</span>
                          <span>Boutique Active</span>
                        </span>
                      ) : (
                        <span className="text-on-surface-variant group-hover:text-primary transition-colors flex items-center gap-1 font-semibold">
                          <span>Visiter la boutique</span>
                          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                        </span>
                      )}

                      <span className="text-[10px] text-secondary font-bold px-2 py-0.5 rounded-md bg-secondary/10">
                        {st.social_tunnel_badge || "WA/FB"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-white/10 bg-surface-container/80 shrink-0">
          {onOpenExplorer && (
            <button
              onClick={() => {
                onClose();
                onOpenExplorer();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer active:scale-98"
            >
              <span className="material-symbols-outlined text-base">grid_view</span>
              <span>Voir la Galerie Complète des Boutiques</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
