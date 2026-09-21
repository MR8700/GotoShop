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

  const getTabTitle = () => {
    if (isTunnel) return "Tunnel Handoff Client";
    if (mode === "client") {
      switch (activeTab) {
        case "commandes":
          return "Mes Commandes";
        case "stats":
          return "Mes Avantages";
        case "reglages":
          return "Mon Profil";
        default:
          return store?.name || "Awa Chic & Tech";
      }
    }
    else {
      switch (activeTab) {
        case "commandes":
          return "Commandes & Arbitrage";
        case "stats":
          return "Stats Globales";
        case "reglages":
          return "Configuration Boutique";
        default:
          return "Boutique";
      }
    }
  };

  return (
    <header className="fixed top-0 w-full z-50 pt-safe bg-surface/80 backdrop-blur-xl shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-16 px-margin flex items-center justify-between gap-space-sm max-w-lg mx-auto">
        {/* Left identity */}
        <div className="flex items-center gap-space-sm min-w-0">
          {isTunnel ? (
            <button
              aria-label="Retour"
              className="w-11 h-11 -ml-2 rounded-full text-on-surface hover:bg-surface-container-high flex items-center justify-center transition-transform active:scale-95 flex-shrink-0"
              onClick={() => onNavigate("boutique")}
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
          ) : null}

          <div className="relative flex-shrink-0">
            <img
              alt="Logo Boutique"
              className="w-10 h-10 min-w-[40px] min-h-[40px] object-cover rounded-xl border border-white/10 shadow-sm cursor-pointer bg-surface-container-highest transition-transform active:scale-95"
              src={getMediaUrl(store?.logo_url) || "/media/store/logo.jpg"}
              onClick={() => onNavigate("boutique")}
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/media/store/logo.jpg";
              }}
            />
          </div>

          <div className="flex flex-col min-w-0 cursor-pointer" onClick={() => onNavigate("boutique")}>
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-sm text-headline-sm text-on-surface truncate">
                {getTabTitle()}
              </span>
              {!isTunnel && (
                <span className={`px-2 py-0.5 rounded-full font-label-sm text-[10px] tracking-wide uppercase flex items-center gap-1 flex-shrink-0 ${
                  mode === "owner"
                    ? "bg-primary-container text-on-primary-container font-bold"
                    : "bg-secondary/15 text-secondary font-semibold"
                }`}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse"></span>
                  {mode === "owner" ? "Commerçante" : (store?.social_tunnel_badge || "WA/FB")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-space-xs text-on-surface-variant font-body-sm text-body-sm">
              <span className="material-symbols-outlined text-[13px] text-secondary">
                {mode === "owner" ? "shield_person" : "bolt"}
              </span>
              <span className="truncate text-xs">
                {mode === "owner" ? "Espace Administration" : (store?.social_tunnel_label || "Tunnel Social Actif")}
              </span>
            </div>
          </div>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-space-xs flex-shrink-0">
          {/* Multi-Store Switcher button */}
          <button
            aria-label="Changer de boutique"
            onClick={onOpenStoreSwitcher}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-secondary flex items-center justify-center transition-transform active:scale-95"
            title="Changer de boutique (Réseau Multi-Commerçants)"
          >
            <span className="material-symbols-outlined text-[18px]">storefront</span>
          </button>

          {/* Share button */}
          <button
            aria-label="Partager"
            onClick={onShare}
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-primary flex items-center justify-center transition-transform active:scale-95"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
          </button>

          {/* Quick Persona Mode Switcher when Owner is Authenticated */}
          {authStatus?.is_authenticated && (
            <button
              onClick={onToggleMode}
              className={`h-8 px-2.5 rounded-full text-[11px] font-bold flex items-center gap-1 transition-all active:scale-95 border ${
                mode === "owner"
                  ? "bg-secondary/20 text-secondary border-secondary/30"
                  : "bg-primary-container text-on-primary-container border-transparent"
              }`}
              title={mode === "owner" ? "Basculer en vue Client" : "Basculer en vue Commerçante"}
            >
              <span className="material-symbols-outlined text-[15px]">
                {mode === "owner" ? "visibility" : "admin_panel_settings"}
              </span>
              <span>{mode === "owner" ? "Vue Client" : "Admin"}</span>
            </button>
          )}

          {/* Customer Avatar / Auth button in Client Mode */}
          {mode === "client" && !authStatus?.is_authenticated && (
            customer ? (
              <button
                onClick={() => onNavigate("reglages")}
                className="flex items-center gap-1.5 p-1 rounded-full hover:bg-surface-container-high transition-all"
                title={`Profil de ${customer.name}`}
              >
                <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-bold ring-2 ring-primary overflow-hidden">
                  {customer.avatar_url ? (
                    <img src={getMediaUrl(customer.avatar_url)} alt="Profil" className="w-full h-full object-cover" />
                  ) : (
                    <span>{customer.name.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
              </button>
            ) : (
              <button
                onClick={onOpenCustomerAuth}
                className="h-8 px-2.5 rounded-full bg-primary-container text-on-primary-container hover:brightness-110 font-label-sm text-xs font-bold flex items-center gap-1 shadow-sm transition-transform active:scale-95"
              >
                <span className="material-symbols-outlined text-[15px]">flash_on</span>
                <span>Connexion</span>
              </button>
            )
          )}

          {/* Owner Profile Dropdown */}
          {authStatus?.is_authenticated ? (
            <div className="relative">
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="relative flex items-center justify-center focus:outline-none"
                title={authStatus?.owner_name || "Commerçante Connectée"}
              >
                <img
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-secondary"
                  src={getMediaUrl(store?.avatar_url)}
                  onError={(e) => {
                    e.target.onerror = null;
                    e.target.src = "/media/store/awa_portrait.jpg";
                  }}
                />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-secondary ring-2 ring-surface"></span>
              </button>

              {/* Dropdown Menu */}
              {showProfileMenu && (
                <div className="absolute right-0 mt-2 w-56 bg-surface-container-high rounded-xl shadow-2xl border border-white/10 p-1.5 z-50 text-xs">
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
                    <span>{mode === "owner" ? "Basculer vue Client" : "Basculer vue Commerçante"}</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      if (onOpenSubscription) onOpenSubscription();
                    }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-surface-container-highest flex items-center gap-2 text-on-surface"
                  >
                    <span className="material-symbols-outlined text-[16px] text-amber-400">verified</span>
                    <span>Mon Abonnement (Orange/Moov)</span>
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
                    <span>Déconnexion Admin</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                onClick={onOpenRegisterStore}
                className="h-8 px-2.5 rounded-full bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:brightness-110 text-white flex items-center gap-1.5 text-[11px] font-extrabold shadow-sm transition-transform active:scale-95 border border-amber-400/30"
                title="Ouvrir ma boutique sur GotoShop"
              >
                <span>⭐</span>
                <span className="hidden xs:inline">Ouvrir ma boutique</span>
              </button>
              <button
                onClick={onOpenLogin}
                className="h-8 px-2 rounded-full bg-surface-container-high hover:bg-surface-container-highest text-on-surface flex items-center gap-1 text-[11px] font-semibold border border-white/5 transition-transform active:scale-95"
                title="Accès Propriétaire de la Boutique"
              >
                <span className="material-symbols-outlined text-[14px] text-secondary">admin_panel_settings</span>
                <span className="hidden sm:inline">Admin</span>
              </button>
              <button
                onClick={onOpenSuperAdmin}
                className="w-8 h-8 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/20 transition-transform active:scale-95"
                title="Console Super-Admin Plateforme"
              >
                <span className="material-symbols-outlined text-[15px]">hub</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
