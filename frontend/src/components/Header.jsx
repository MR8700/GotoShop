import React, { useState } from "react";
import { getMediaUrl } from "../api/client";

export default function Header({
  store,
  activeTab,
  onShare,
  onNavigate,
  mode = "client",
  onToggleMode,
  authStatus,
  customer,
  onOpenCustomerAuth,
  onOpenLogin,
  onOpenChangePassword,
  onLogout,
  onOpenStoreSwitcher,
  onOpenSuperAdmin,
  onOpenRegisterStore,
  onOpenSubscription,
  onOpenExplorer,
}) {
  const isTunnel = activeTab === "tunnel";
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);

  const getTabTitle = () => {
    if (isTunnel) return "Commande";
    if (mode === "client") {
      switch (activeTab) {
        case "commandes":
          return "Commandes";
        case "stats":
          return "Avantages";
        case "reglages":
          return "Profil";
        default:
          return store?.name || "Boutique";
      }
    } else {
      switch (activeTab) {
        case "commandes":
          return "Arbitrage";
        case "stats":
          return "Statistiques";
        case "reglages":
          return "Paramètres";
        default:
          return store?.name || "Boutique";
      }
    }
  };

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-md border-b border-white/[0.07] pt-safe transition-all duration-200">
        <div className="h-15 sm:h-16 px-4 sm:px-6 max-w-5xl mx-auto flex items-center justify-between gap-3">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-2.5 min-w-0">
            {isTunnel && (
              <button
                aria-label="Retour au catalogue"
                onClick={() => onNavigate("boutique")}
                className="w-8 h-8 -ml-1 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-white/[0.06] flex items-center justify-center transition-colors active:scale-95 shrink-0"
              >
                <span className="material-symbols-outlined text-[19px]">arrow_back</span>
              </button>
            )}

            {/* Logo */}
            <div
              onClick={() => onNavigate("boutique")}
              className="relative shrink-0 cursor-pointer group"
              title={store?.name || "Boutique"}
            >
              <img
                alt={store?.name || "Logo"}
                src={getMediaUrl(store?.logo_url) || "/media/store/logo.jpg"}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "/media/store/logo.jpg";
                }}
                className="w-8 h-8 sm:w-9 sm:h-9 object-cover rounded-xl border border-white/[0.08] bg-surface-container shadow-sm group-hover:border-white/20 transition-all"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-secondary ring-2 ring-surface" />
            </div>

            {/* Store title & micro status */}
            <div
              onClick={() => onNavigate("boutique")}
              className="flex flex-col min-w-0 cursor-pointer"
            >
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-sm sm:text-[15px] text-on-surface tracking-tight truncate max-w-[140px] xs:max-w-[190px] sm:max-w-[260px]">
                  {getTabTitle()}
                </span>
                {store?.is_verified && (
                  <span
                    className="material-symbols-outlined text-[15px] text-secondary shrink-0"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                    title="Boutique vérifiée"
                  >
                    verified
                  </span>
                )}
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-on-surface-variant font-normal">
                {mode === "owner" ? (
                  <span className="text-secondary font-medium">Administration commerçante</span>
                ) : (
                  <span>{store?.delivery_city?.split("(")[0]?.trim() || "Burkina Faso"} • Commande directe</span>
                )}
              </span>
            </div>
          </div>

          {/* Right: Actions & Navigation */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Explorer button */}
            {onOpenExplorer && (
              <button
                onClick={onOpenExplorer}
                className="h-8 px-2.5 sm:px-3 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] text-on-surface-variant hover:text-on-surface text-xs font-medium border border-white/[0.07] flex items-center gap-1.5 transition-all active:scale-95"
                title="Explorer toutes les boutiques"
              >
                <span className="material-symbols-outlined text-[16px] text-primary">storefront</span>
                <span className="hidden xs:inline">Toutes les Boutiques</span>
              </button>
            )}

            {/* Persona mode toggle when owner authenticated */}
            {authStatus?.is_authenticated && (
              <button
                onClick={onToggleMode}
                className={`h-8 px-2.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95 border ${
                  mode === "owner"
                    ? "bg-secondary/15 text-secondary border-secondary/30"
                    : "bg-primary/15 text-primary border-primary/30"
                }`}
                title={mode === "owner" ? "Basculer en vue client" : "Basculer en vue gestion"}
              >
                <span className="material-symbols-outlined text-[15px]">
                  {mode === "owner" ? "visibility" : "admin_panel_settings"}
                </span>
                <span className="hidden sm:inline">{mode === "owner" ? "Vue Client" : "Vue Admin"}</span>
              </button>
            )}

            {/* Customer Quick Auth in client mode */}
            {mode === "client" && !authStatus?.is_authenticated && (
              customer ? (
                <button
                  onClick={() => onNavigate("reglages")}
                  className="flex items-center gap-1.5 h-8 pl-1 pr-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.07] transition-all"
                  title={`Compte de ${customer.name}`}
                >
                  <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-[11px] font-bold">
                    {customer.name?.slice(0, 1).toUpperCase() || "C"}
                  </div>
                  <span className="text-xs font-medium text-on-surface hidden sm:inline max-w-[80px] truncate">
                    {customer.name}
                  </span>
                </button>
              ) : (
                <button
                  onClick={onOpenCustomerAuth}
                  className="h-8 px-3 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-semibold shadow-sm transition-all active:scale-95 flex items-center gap-1"
                  title="Connexion ou Inscription rapide"
                >
                  <span className="material-symbols-outlined text-[15px]">login</span>
                  <span>Connexion</span>
                </button>
              )
            )}

            {/* Authenticated Owner Avatar & Menu */}
            {authStatus?.is_authenticated && (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="relative flex items-center justify-center p-0.5 rounded-xl border border-white/[0.1] hover:border-secondary/50 transition-colors"
                  title={authStatus?.owner_name || "Gérante"}
                >
                  <img
                    alt="Profil Commerçante"
                    src={getMediaUrl(store?.avatar_url) || "/media/store/awa_portrait.jpg"}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = "/media/store/awa_portrait.jpg";
                    }}
                    className="w-7 h-7 rounded-lg object-cover"
                  />
                  <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-secondary ring-1 ring-surface" />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-surface-container border border-white/[0.08] rounded-2xl shadow-dropdown p-1.5 z-50 text-xs animate-fade-in divide-y divide-white/[0.06]">
                    <div className="px-3 py-2">
                      <p className="font-semibold text-on-surface truncate">{authStatus.owner_name || "Commerçante"}</p>
                      <p className="text-[11px] text-secondary font-medium">Propriétaire boutique</p>
                    </div>

                    <div className="py-1 space-y-0.5">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onToggleMode();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2 text-on-surface"
                      >
                        <span className="material-symbols-outlined text-[16px] text-secondary">
                          {mode === "owner" ? "smartphone" : "store"}
                        </span>
                        <span>{mode === "owner" ? "Passer en vue client" : "Passer en gestion"}</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          if (onOpenSubscription) onOpenSubscription();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2 text-on-surface"
                      >
                        <span className="material-symbols-outlined text-[16px] text-amber-400">workspace_premium</span>
                        <span>Abonnement SaaS</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          if (onOpenStoreSwitcher) onOpenStoreSwitcher();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2 text-on-surface"
                      >
                        <span className="material-symbols-outlined text-[16px] text-primary">storefront</span>
                        <span>Changer de boutique</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onOpenChangePassword();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2 text-on-surface"
                      >
                        <span className="material-symbols-outlined text-[16px] text-slate-400">key</span>
                        <span>Mot de passe</span>
                      </button>
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-500/10 flex items-center gap-2 text-red-400 font-medium"
                      >
                        <span className="material-symbols-outlined text-[16px]">logout</span>
                        <span>Déconnexion</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* More options menu button */}
            <div className="relative">
              <button
                onClick={() => setShowToolsMenu(!showToolsMenu)}
                aria-label="Options"
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all active:scale-95 border ${
                  showToolsMenu
                    ? "bg-white/[0.1] text-on-surface border-white/20"
                    : "bg-white/[0.04] hover:bg-white/[0.08] text-on-surface-variant hover:text-on-surface border-white/[0.07]"
                }`}
                title="Options et outils"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showToolsMenu ? "close" : "more_vert"}
                </span>
              </button>

              {showToolsMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-surface-container border border-white/[0.08] rounded-2xl shadow-dropdown p-1.5 z-50 text-xs animate-fade-in divide-y divide-white/[0.06]">
                  <div className="py-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        onShare();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2.5 text-on-surface transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px] text-primary">share</span>
                      <span>Partager la vitrine</span>
                    </button>

                    {onOpenExplorer && (
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          onOpenExplorer();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2.5 text-on-surface transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px] text-primary">grid_view</span>
                        <span>Galerie des 100 boutiques</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        onOpenStoreSwitcher();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2.5 text-on-surface transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px] text-secondary">storefront</span>
                      <span>Changer de boutique</span>
                    </button>
                  </div>

                  <div className="pt-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        onOpenRegisterStore();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary font-semibold flex items-center gap-2.5 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">add_business</span>
                      <span>Ouvrir ma boutique</span>
                    </button>

                    {!authStatus?.is_authenticated && (
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          onOpenLogin();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2.5 text-on-surface-variant hover:text-on-surface transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px]">shield_person</span>
                        <span>Espace Commerçant</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        onOpenSuperAdmin();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-white/[0.06] flex items-center gap-2.5 text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px] text-amber-400">hub</span>
                      <span>Console Super-Admin</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Backdrop overlay for closing open menus on tap outside */}
      {(showProfileMenu || showToolsMenu) && (
        <div
          onClick={() => {
            setShowProfileMenu(false);
            setShowToolsMenu(false);
          }}
          className="fixed inset-0 z-30 bg-transparent"
        />
      )}
    </>
  );
}
