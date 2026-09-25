import Icon from "./Icon";
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
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
    >
      <div className="w-full max-w-xl bg-surface-card border border-subtle rounded-2xl shadow-dropdown overflow-hidden max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-subtle flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="storefront" className="text-[20px]" />
            </div>
            <div>
              <h3 className="font-semibold text-on-surface text-base">Changer de Boutique</h3>
              <p className="text-xs text-on-surface-variant">
                Vitrines locales vérifiées et indépendantes
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface-variant hover:text-on-surface border border-subtle flex items-center justify-center transition-colors active:scale-95 cursor-pointer"
            aria-label="Fermer"
          >
            <Icon name="close" className="text-[18px]" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="p-4 border-b border-subtle bg-surface-secondary/30 shrink-0 space-y-2">
          <div className="relative">
            <Icon name="search" className="absolute left-3.5 top-2.5 text-on-surface-variant text-[18px]" />
            <input
              type="text"
              placeholder="Rechercher une boutique par nom, ville ou spécialité..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-9 rounded-xl bg-surface-secondary border border-subtle text-on-surface placeholder:text-on-surface-variant/50 text-xs sm:text-sm focus:outline-none focus:border-strong transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-2.5 w-5 h-5 rounded-full bg-surface-elevated text-on-surface-variant hover:text-on-surface flex items-center justify-center text-xs cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>
          <div className="flex items-center justify-between text-xs text-on-surface-variant px-1">
            <span>
              {filteredStores.length} boutique{filteredStores.length > 1 ? "s" : ""} trouvée{filteredStores.length > 1 ? "s" : ""}
            </span>
            <span className="flex items-center gap-1 text-on-surface-variant">
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
              <Icon name="storefront" className="text-2xl text-slate-400" />
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
                        : "bg-surface-card hover:bg-surface-secondary border-subtle hover:border-strong"
                    }`}
                  >
                    {/* Top row */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="relative shrink-0">
                        {st.logo_url ? (
                          <img
                            src={getMediaUrl(st.logo_url)}
                            alt=""
                            className="w-11 h-11 rounded-lg object-cover border border-subtle bg-surface-secondary"
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.style.display = "none";
                              if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                            }}
                          />
                        ) : null}
                        <div
                          className={`w-11 h-11 rounded-lg border border-subtle bg-primary/10 text-primary items-center justify-center font-bold text-sm ${st.logo_url ? "hidden" : "flex"}`}
                        >
                          {st.name?.charAt(0) || "B"}
                        </div>
                        {st.is_verified && (
                          <span
                            className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-secondary text-white flex items-center justify-center text-[9px] font-bold shadow"
                            title="Vérifiée"
                          >
                            ✓
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className="font-semibold text-on-surface text-xs sm:text-sm truncate group-hover:text-primary transition-colors">
                            {st.name}
                          </h4>
                          <span className="shrink-0 text-[11px] font-semibold text-amber-500">
                            ★ {st.rating || 4.9}
                          </span>
                        </div>

                        <div className="text-xs text-on-surface-variant mt-0.5 truncate flex items-center gap-1">
                          <Icon name="location_on" className="text-[12px] text-secondary" />
                          <span>{st.delivery_city?.split("(")[0]?.trim() || "Burkina Faso"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Tagline */}
                    <p className="text-xs text-on-surface-variant line-clamp-1 leading-relaxed">
                      {st.tagline || st.description}
                    </p>

                    {/* Action Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-subtle text-xs">
                      {isSelected ? (
                        <span className="text-[11px] font-semibold text-primary flex items-center gap-1">
                          <span>✓</span>
                          <span>Boutique Active</span>
                        </span>
                      ) : (
                        <span className="text-on-surface-variant group-hover:text-primary transition-colors flex items-center gap-1 text-[11px] font-medium">
                          <span>Visiter</span>
                          <Icon name="arrow_forward" className="text-[13px]" />
                        </span>
                      )}

                      <span className="text-[10px] text-on-surface-variant/80 font-medium">
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
        <div className="p-4 border-t border-subtle bg-surface-secondary/20 shrink-0">
          {onOpenExplorer && (
            <button
              onClick={() => {
                onClose();
                onOpenExplorer();
              }}
              className="w-full py-2.5 px-4 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-on-surface text-xs font-semibold border border-subtle transition flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
            >
              <Icon name="grid_view" className="text-[16px] text-primary" />
              <span>Voir la Galerie Complète des Boutiques</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
