import React, { useState, useEffect } from "react";
import { fetchPublicStores, getActiveStoreSlug, setActiveStoreSlug } from "../api/client";

export default function StoreSwitcherModal({ isOpen, onClose, onSelectStore, onOpenSuperAdmin, onOpenExplorer }) {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const activeSlug = getActiveStoreSlug();

  useEffect(() => {
    if (isOpen) {
      loadStores();
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

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-surface-container-high border border-white/10 rounded-3xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-lg">storefront</span>
            </div>
            <div>
              <h3 className="font-extrabold text-on-surface text-sm">Changer de Boutique</h3>
              <p className="text-[11px] text-on-surface-variant">Réseau Multi-Commerçants ConversaStore</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-surface-container-highest text-on-surface-variant hover:text-on-surface flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Current Active Info */}
        <div className="p-3 rounded-2xl bg-surface-container-highest/60 border border-white/5 text-xs">
          <span className="text-on-surface-variant text-[11px]">Boutique active actuelle :</span>
          <p className="font-bold text-on-surface text-sm mt-0.5">
            {stores.find((s) => s.slug === activeSlug)?.name || (activeSlug ? activeSlug : "Faso Danfani & Élégance")}
          </p>
          <p className="text-[10px] text-primary font-mono mt-0.5">
            Lien d'accès : ?store={activeSlug || "faso-danfani"}
          </p>
        </div>

        {/* Stores List */}
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {loading ? (
            <div className="text-center py-6 text-xs text-on-surface-variant">Chargement des boutiques...</div>
          ) : stores.length === 0 ? (
            <div className="text-center py-6 text-xs text-on-surface-variant">Aucune boutique disponible</div>
          ) : (
            stores.map((st) => {
              const isSelected = activeSlug === st.slug || (!activeSlug && st.slug === "faso-danfani");

              return (
                <button
                  key={st.id}
                  onClick={() => {
                    setActiveStoreSlug(st.slug);
                    if (onSelectStore) onSelectStore(st.slug);
                    onClose();
                  }}
                  className={`w-full text-left p-3 rounded-2xl border transition flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-primary/10 border-primary/40 shadow-sm"
                      : "bg-surface-container hover:bg-surface-container-highest border-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white text-sm shadow-inner shrink-0"
                      style={{ backgroundColor: st.primary_color || "#ec761e" }}
                    >
                      {st.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-on-surface text-xs truncate">{st.name}</span>
                        {isSelected && (
                          <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-primary text-on-primary">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-on-surface-variant truncate font-mono">
                        ?store={st.slug} • {st.delivery_city || "Burkina Faso"}
                      </p>
                    </div>
                  </div>

                  <span className="material-symbols-outlined text-primary text-base shrink-0">
                    {isSelected ? "check_circle" : "arrow_forward"}
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* Footer actions */}
        <div className="pt-2 border-t border-white/5 space-y-2">
          {onOpenExplorer && (
            <button
              onClick={() => {
                onClose();
                onOpenExplorer();
              }}
              className="w-full py-2.5 px-3 rounded-xl bg-primary/15 hover:bg-primary/25 text-primary text-xs font-bold transition flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-base">grid_view</span>
              <span>Voir la Galerie Complète des Boutiques</span>
            </button>
          )}

          <button
            onClick={() => {
              onClose();
              if (onOpenSuperAdmin) onOpenSuperAdmin();
            }}
            className="w-full py-2 px-3 rounded-xl bg-surface-container-highest hover:bg-surface-container-highest/80 text-on-surface-variant hover:text-on-surface text-xs font-semibold transition flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm text-amber-400">hub</span>
            <span>Console Super-Admin Plateforme</span>
          </button>
        </div>
      </div>
    </div>
  );
}
