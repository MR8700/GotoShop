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
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <div className="w-full max-w-xl bg-surface-container border border-white/[0.08] rounded-2xl shadow-dropdown overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">storefront</span>
            </div>
            <div>
              <h3 className="font-semibold text-white text-base">Changer de Boutique</h3>
              <p className="text-xs text-slate-400">
                100 vitrines certifiées au Burkina Faso et en Afrique
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-400 hover:text-white flex items-center justify-center transition-colors active:scale-95"
            aria-label="Fermer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-white/[0.06] bg-white/[0.01] shrink-0 space-y-2">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3.5 top-2.5 text-slate-400 text-[18px]">
              search
            </span>
            <input
              type="text"
              placeholder="Rechercher une boutique par nom, ville ou spécialité..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-surface border border-white/[0.08] text-white placeholder:text-slate-500 text-xs sm:text-sm focus:outline-none focus:border-white/20 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 w-5 h-5 rounded-full bg-white/[0.08] text-slate-400 flex items-center justify-center hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 px-1">
            <span>
              {filteredStores.length} boutique{filteredStores.length > 1 ? "s" : ""} trouvée{filteredStores.length > 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1 text-slate-400">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              Commande directe
            </span>
          </div>
        </div>

        {/* Stores List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-2.5">
          {loading ? (
            <div className="text-center py-16 space-y-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs text-slate-400">Chargement des boutiques...</p>
            </div>
          ) : filteredStores.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white/[0.02] rounded-xl border border-white/[0.06] space-y-2">
              <span className="material-symbols-outlined text-2xl text-slate-400">storefront</span>
              <p className="font-semibold text-sm text-white">Aucune boutique trouvée</p>
              <p className="text-xs text-slate-400">
                Aucun résultat pour "{searchQuery}".
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredStores.map((st) => {
                const isSelected = activeSlug === st.slug || (!activeSlug && st.slug === "faso-danfani");

                return (
                  <div
                    key={st.id}
                    onClick={() => {
                      setActiveStoreSlug(st.slug);
                      if (onSelectStore) onSelectStore(st.slug);
                      onClose();
                    }}
                    className={`relative p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2.5 group ${
                      isSelected
                        ? "bg-primary/10 border-primary/40 shadow-sm"
                        : "bg-surface hover:bg-white/[0.04] border-white/[0.06] hover:border-white/[0.14]"
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <img
                          src={getMediaUrl(st.logo_url) || "/media/store/logo.jpg"}
                          alt={st.name}
                          className="w-11 h-11 rounded-lg object-cover border border-white/[0.08] bg-surface"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = "/media/store/logo.jpg";
                          }}
                        />
                        {st.is_verified && (
                          <span
                            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-secondary text-slate-900 flex items-center justify-center text-[9px] font-bold shadow"
                            title="Vérifiée"
                          >
                            ✓
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-semibold text-white text-xs sm:text-sm truncate group-hover:text-primary transition-colors">
                            {st.name}
                          </h4>
                          <span className="shrink-0 text-[11px] font-semibold text-amber-400">
                            ★ {st.rating || 4.9}
                          </span>
                        </div>

                        <div className="text-xs text-slate-400 mt-0.5 truncate flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px] text-secondary">location_on</span>
                          <span>{st.delivery_city?.split("(")[0]?.trim() || "Burkina Faso"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Tagline */}
                    <p className="text-xs text-slate-400 line-clamp-1 leading-relaxed">
                      {st.tagline || st.description}
                    </p>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-white/[0.06] text-xs">
                      {isSelected ? (
                        <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                          <span>✓</span>
                          <span>Boutique Active</span>
                        </span>
                      ) : (
                        <span className="text-slate-400 group-hover:text-primary transition-colors flex items-center gap-1 text-[11px] font-medium">
                          <span>Visiter</span>
                          <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                        </span>
                      )}

                      <span className="text-[10px] text-slate-400 font-medium">
                        {st.social_tunnel_badge || "WA Direct"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/[0.06] bg-white/[0.01] shrink-0">
          {onOpenExplorer && (
            <button
              onClick={() => {
                onClose();
                onOpenExplorer();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-white text-xs font-semibold border border-white/[0.08] transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[16px] text-primary">grid_view</span>
              <span>Voir la Galerie Complète des 100 Boutiques</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
