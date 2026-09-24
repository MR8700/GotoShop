import React, { useState, useEffect } from "react";
import Icon from "./Icon";
import { fetchMyStores, unsubscribeFromStore, getMediaUrl } from "../api/client";

export default function MyStoresPage({
  customer,
  onSelectStore,
  onOpenExplorer,
  onOpenCustomerAuth,
  showToast,
}) {
  const [activeTab, setActiveTab] = useState("SUBSCRIBED"); // SUBSCRIBED, RECENT
  const [subscribedStores, setSubscribedStores] = useState([]);
  const [recentStores, setRecentStores] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStores();
  }, [customer?.id]);

  const loadStores = async () => {
    try {
      setLoading(true);
      const res = await fetchMyStores(customer?.id);
      setSubscribedStores(res.subscribed_stores || []);
      setRecentStores(res.recent_stores || []);
    } catch (e) {
      console.error("Erreur chargement mes boutiques:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleUnsubscribe = async (storeId, storeName, e) => {
    e.stopPropagation();
    try {
      await unsubscribeFromStore(storeId, customer?.id);
      setSubscribedStores((prev) => prev.filter((s) => s.id !== storeId));
      if (showToast) showToast(`Désabonné de ${storeName}`);
    } catch (err) {
      if (showToast) showToast("Erreur lors du désabonnement");
    }
  };

  const currentList = activeTab === "SUBSCRIBED" ? subscribedStores : recentStores;

  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      {/* Page Header */}
      <div className="rounded-3xl border border-subtle bg-surface-container p-5 sm:p-6 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon name="loyalty" className="text-[22px]" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-on-surface">
                Mes Boutiques
              </h1>
              <p className="text-xs text-on-surface-variant">
                Vos boutiques suivies et vos points de contact récents
              </p>
            </div>
          </div>

          <button
            onClick={onOpenExplorer}
            className="h-8 px-3 rounded-xl bg-surface-secondary hover:bg-surface-elevated text-primary text-xs font-semibold border border-subtle flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Icon name="travel_explore" className="text-[16px]" />
            <span className="hidden sm:inline">Explorer le réseau</span>
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex items-center gap-2 pt-2 border-t border-subtle">
          <button
            onClick={() => setActiveTab("SUBSCRIBED")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "SUBSCRIBED"
                ? "bg-primary text-white shadow-xs"
                : "bg-surface-secondary text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Icon name="notifications_active" className="text-[15px]" />
            <span>Suivies ({subscribedStores.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("RECENT")}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === "RECENT"
                ? "bg-primary text-white shadow-xs"
                : "bg-surface-secondary text-on-surface-variant hover:text-on-surface"
            }`}
          >
            <Icon name="history" className="text-[15px]" />
            <span>Accès Récents ({recentStores.length})</span>
          </button>
        </div>
      </div>

      {/* Guest Notice if not logged in */}
      {!customer && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between gap-3 text-amber-600 dark:text-amber-400">
          <div className="flex items-center gap-2">
            <Icon name="info" className="text-[18px] shrink-0" />
            <span>Connectez-vous pour retrouver vos boutiques suivies sur tous vos appareils.</span>
          </div>
          <button
            onClick={onOpenCustomerAuth}
            className="px-3 py-1 rounded-xl bg-amber-500 text-white font-semibold hover:brightness-105 shrink-0 transition-colors"
          >
            Connexion
          </button>
        </div>
      )}

      {/* Stores List */}
      {loading ? (
        <div className="py-20 text-center text-xs text-on-surface-variant">
          <Icon name="sync" className="text-[24px] animate-spin mb-2 text-primary" />
          <p>Synchronisation de vos boutiques...</p>
        </div>
      ) : currentList.length === 0 ? (
        <div className="p-8 text-center rounded-3xl border border-subtle bg-surface-container space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-surface-secondary flex items-center justify-center text-on-surface-variant">
            <Icon name={activeTab === "SUBSCRIBED" ? "loyalty" : "history"} className="text-[28px]" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-on-surface text-base">
              {activeTab === "SUBSCRIBED"
                ? "Aucune boutique suivie pour le moment"
                : "Aucun accès récent enregistré"}
            </h3>
            <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
              {activeTab === "SUBSCRIBED"
                ? "Abonnez-vous aux boutiques qui vous plaisent pour recevoir leurs nouveautés et promotions."
                : "Vos visites de boutiques et commandes récentes apparaîtront ici pour un accès rapide."}
            </p>
          </div>
          <button
            onClick={onOpenExplorer}
            className="h-10 px-5 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-all"
          >
            <Icon name="storefront" className="text-[16px]" />
            <span>Découvrir les boutiques</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {currentList.map((st) => (
            <div
              key={st.id}
              onClick={() => onSelectStore(st.slug)}
              className="p-4 rounded-2xl border border-subtle bg-surface-container hover:bg-surface-secondary/70 transition-all cursor-pointer group flex flex-col justify-between gap-3 shadow-xs hover:shadow-card hover:border-primary/30"
            >
              <div className="flex items-start gap-3">
                <img
                  src={getMediaUrl(st.logo_url) || "/media/store/logo.jpg"}
                  alt={st.name}
                  className="w-12 h-12 rounded-xl object-cover border border-subtle shrink-0 group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/media/store/logo.jpg";
                  }}
                />
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-on-surface text-sm truncate group-hover:text-primary transition-colors">
                    {st.name}
                  </h4>
                  <p className="text-xs text-on-surface-variant truncate">
                    {st.tagline || "Boutique en ligne"}
                  </p>
                  <p className="text-[11px] text-on-surface-variant/70 pt-0.5">
                    {st.delivery_city?.split("(")[0]?.trim() || st.country || "Afrique"}
                  </p>
                </div>
              </div>

              <div className="pt-2 border-t border-subtle flex items-center justify-between text-xs">
                <span className="text-primary font-semibold flex items-center gap-1 text-[11px]">
                  <span>Accéder à la boutique</span>
                  <Icon name="arrow_forward" className="text-[13px]" />
                </span>

                {activeTab === "SUBSCRIBED" && (
                  <button
                    onClick={(e) => handleUnsubscribe(st.id, st.name, e)}
                    className="text-[11px] text-on-surface-variant hover:text-red-500 px-2 py-0.5 rounded-lg hover:bg-red-500/10 transition-colors"
                    title="Se désabonner de cette boutique"
                  >
                    Se désabonner
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
