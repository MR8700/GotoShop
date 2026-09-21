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
          return store?.name || "Awa Chic & Tech";
      }
    } else {
      switch (activeTab) {
        case "commandes":
          return "Arbitrage";
        case "stats":
          return "Stats";
        case "reglages":
          return "Réglages";
        default:
          return "Boutique";
      }
    }
  };

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-surface/85 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.06)] border-b border-white/5">
      <div className="h-14 sm:h-16 px-3 sm:px-margin flex items-center justify-between gap-2 max-w-lg mx-auto">
        {/* Left Identity: Minimalist, compact, logo focused */}
        <div className="flex items-center gap-2 min-w-0">
          {isTunnel && (
            <button
              aria-label="Retour"
              className="w-8 h-8 -ml-1 rounded-full text-on-surface hover:bg-surface-container-high flex items-center justify-center transition-transform active:scale-95 flex-shrink-0"
              onClick={() => onNavigate("boutique")}
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
          )}

          {/* Boutique Logo with Active Status Indicator */}
          <div
            className="relative flex-shrink-0 cursor-pointer"
            onClick={() => onNavigate("boutique")}
            title={store?.name || "Boutique"}
          >
            <img
              alt={store?.name || "Logo"}
              className="w-8 h-8 sm:w-10 sm:h-10 object-cover rounded-xl border border-white/10 shadow-sm bg-surface-container-highest transition-transform active:scale-95"
              src={getMediaUrl(store?.logo_url) || "/media/store/logo.jpg"}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/media/store/logo.jpg";
              }}
            />
            <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-secondary ring-1 ring-surface animate-pulse" />
          </div>

          {/* Clean Title without heavy text on mobile */}
          <div
            className="flex flex-col min-w-0 cursor-pointer"
            onClick={() => onNavigate("boutique")}
          >
            <span className="font-headline-sm text-sm sm:text-base font-bold text-on-surface truncate max-w-[130px] xs:max-w-[170px] sm:max-w-[220px]">
              {getTabTitle()}
            </span>
            {/* Subtitle visible on tablet/desktop, kept ultra-light on mobile */}
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] text-on-surface-variant">
              <span className="material-symbols-outlined text-[12px] text-secondary">
                {mode === "owner" ? "shield_person" : "bolt"}
              </span>
              <span className="truncate">
                {mode === "owner" ? "Administration" : (store?.social_tunnel_label || "Tunnel Social Actif")}
              </span>
            </span>
          </div>
        </div>

        {/* Right Actions: Compact & Grouped Menu */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Quick Persona Mode Switcher when Owner is Authenticated */}
          {authStatus?.is_authenticated && (
            <button
              onClick={onToggleMode}
              className={`h-7 sm:h-8 px-2 rounded-full text-[10px] sm:text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 border ${
                mode === "owner"
                  ? "bg-secondary/20 text-secondary border-secondary/30"
                  : "bg-primary-container text-on-primary-container border-transparent"
              }`}
              title={mode === "owner" ? "Basculer en vue Client" : "Basculer en vue Commerçante"}
            >
              <span className="material-symbols-outlined text-[14px]">
                {mode === "owner" ? "visibility" : "admin_panel_settings"}
              </span>
              <span className="hidden xs:inline">{mode === "owner" ? "Client" : "Admin"}</span>
            </button>
          )}

          {/* Customer Profile / Quick Auth Button in Client Mode */}
          {mode === "client" && !authStatus?.is_authenticated && (
            customer ? (
              <button
                onClick={() => onNavigate("reglages")}
                className="flex items-center p-0.5 rounded-full hover:bg-surface-container-high transition-all"
                title={`Profil de ${customer.name}`}
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-bold ring-2 ring-primary overflow-hidden">
                  {customer.avatar_url ? (
                    <img src={getMediaUrl(customer.avatar_url)} alt="Profil" className="w-full h-full object-cover" />
                  ) : (
                    <span>{customer.name?.slice(0, 2).toUpperCase() || "VIP"}</span>
                  )}
                </div>
              </button>
            ) : (
              <button
                onClick={onOpenCustomerAuth}
                className="h-7 sm:h-8 px-2 rounded-full bg-primary-container text-on-primary-container hover:brightness-110 text-[11px] font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                title="Accès Client Rapide"
              >
                <span className="material-symbols-outlined text-[14px]">flash_on</span>
                <span>Connexion</span>
              </button>
            )
          )}

          {/* Authenticated Owner Profile Dropdown */}
          {authStatus?.is_authenticated ? (
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="relative flex items-center justify-center focus:outline-none"
                title={authStatus?.owner_name || "Commerçante Connectée"}
              >
                <img
                  alt="Profile"
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover ring-2 ring-secondary"
                  src={getMediaUrl(store?.avatar_url)}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/media/store/awa_portrait.jpg";
                  }}
                />
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-secondary ring-1 ring-surface" />
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-surface-container-high rounded-xl shadow-2xl border border-white/10 p-1.5 z-50 text-xs animate-fade-in">
                  <div className="px-2.5 py-2 border-b border-white/5 mb-1">
                    <p className="font-bold text-on-surface truncate">{authStatus.owner_name || "Awa Traoré"}</p>
                    <p className="text-[10px] text-secondary">Commerçante Propriétaire</p>
                  </div>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onToggleMode();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-container-highest flex items-center gap-2 text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px] text-secondary">
                      {mode === "owner" ? "smartphone" : "store"}
                    </span>
                    <span>{mode === "owner" ? "Vue Client" : "Vue Commerçante"}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      if (onOpenSubscription) onOpenSubscription();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-container-highest flex items-center gap-2 text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px] text-amber-400">verified</span>
                    <span>Mon Abonnement SaaS</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      if (onOpenStoreSwitcher) onOpenStoreSwitcher();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-container-highest flex items-center gap-2 text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px] text-secondary">storefront</span>
                    <span>Changer de Boutique</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      if (onOpenSuperAdmin) onOpenSuperAdmin();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-container-highest flex items-center gap-2 text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px] text-amber-400">hub</span>
                    <span>Console Super-Admin</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenChangePassword();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-container-highest flex items-center gap-2 text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px] text-primary">key</span>
                    <span>Changer mot de passe</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onLogout();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-red-500/15 flex items-center gap-2 text-red-400"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    <span>Déconnexion</span>
                  </button>
                </div>
              )}
            </div>
          ) : null}

          {/* UNIFIED MENU BUTTON: Replaces all cluttered individual icon buttons */}
          <div className="relative">
            <button
              onClick={() => setShowToolsMenu(!showToolsMenu)}
              aria-label="Menu des options et gestion"
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-all active:scale-95 border ${
                showToolsMenu
                  ? "bg-primary text-surface border-primary"
                  : "bg-surface-container-high hover:bg-surface-container-highest text-on-surface border-white/5"
              }`}
              title="Menu & Outils Plateforme"
            >
              <span className="material-symbols-outlined text-[18px]">
                {showToolsMenu ? "close" : "more_vert"}
              </span>
            </button>

            {/* Unfolded Menu Dropdown */}
            {showToolsMenu && (
              <div className="absolute right-0 mt-2 w-56 bg-surface-container-high rounded-2xl shadow-2xl border border-white/10 p-1.5 z-50 text-xs animate-fade-in divide-y divide-white/5">
                <div className="p-1 space-y-1">
                  {/* Share Store */}
                  <button
                    onClick={() => {
                      setShowToolsMenu(false);
                      onShare();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-container-highest flex items-center gap-2.5 text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[17px] text-primary">share</span>
                    <span className="font-semibold">Partager la boutique</span>
                  </button>

                  {/* Multi-store switcher */}
                  <button
                    onClick={() => {
                      setShowToolsMenu(false);
                      onOpenStoreSwitcher();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-container-highest flex items-center gap-2.5 text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[17px] text-secondary">storefront</span>
                    <span>Changer de boutique</span>
                  </button>
                </div>

                <div className="p-1 space-y-1">
                  {/* Create New Store */}
                  <button
                    onClick={() => {
                      setShowToolsMenu(false);
                      onOpenRegisterStore();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500/15 to-orange-500/15 hover:from-amber-500/25 hover:to-orange-500/25 flex items-center gap-2.5 text-amber-300 font-bold transition-all"
                  >
                    <span className="text-[14px]">⭐</span>
                    <span>Créer ma boutique</span>
                  </button>

                  {/* Merchant Owner Admin Login */}
                  {!authStatus?.is_authenticated && (
                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        onOpenLogin();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-container-highest flex items-center gap-2.5 text-on-surface transition-colors"
                    >
                      <span className="material-symbols-outlined text-[17px] text-secondary">admin_panel_settings</span>
                      <span>Accès Propriétaire (Admin)</span>
                    </button>
                  )}

                  {/* Platform Super-Admin Console */}
                  <button
                    onClick={() => {
                      setShowToolsMenu(false);
                      onOpenSuperAdmin();
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-container-highest flex items-center gap-2.5 text-on-surface-variant hover:text-on-surface transition-colors"
                  >
                    <span className="material-symbols-outlined text-[17px] text-amber-400">hub</span>
                    <span>Console Super-Admin</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
