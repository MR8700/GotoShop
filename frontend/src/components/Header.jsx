import Icon from "./Icon";
import React, { useState } from "react";
import { getMediaUrl } from "../api/client";
import ThemeToggle from "./ThemeToggle";
import NotificationBell from "./NotificationBell";

export default function Header({
  store,
  activeTab,
  onShare,
  onNavigate,
  mode = "client",
  onToggleMode,
  authStatus,
  isCurrentStoreOwner = false,
  onGoToMyStore,
  myStoreSlug,
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
  onOpenNotifications,
  onOpenQrModal,
  onOpenMyStores,
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
        case "chat":
          return "Chat Vendeur";
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
        case "chat":
          return "Messagerie Client";
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
      <header className="fixed top-0 inset-x-0 z-40 bg-surface/90 backdrop-blur-md border-b border-subtle pt-safe transition-all duration-200">
        <div className="h-14 sm:h-16 px-2.5 sm:px-4 md:px-6 max-w-5xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink">
            {isTunnel && (
              <button
                aria-label="Retour au catalogue"
                onClick={() => onNavigate("boutique")}
                className="w-7 h-7 sm:w-8 sm:h-8 -ml-1 rounded-xl text-on-surface-variant hover:text-on-surface hover:bg-surface-secondary flex items-center justify-center transition-colors active:scale-95 shrink-0"
              >
                <Icon name="arrow_back" className="text-[18px]" />
              </button>
            )}

            {/* Logo */}
            <div
              onClick={() => onNavigate("boutique")}
              className="relative shrink-0 cursor-pointer group"
              title={store?.name || "Boutique"}
            >
              <img
                alt=""
                src={getMediaUrl(store?.logo_url) || "/media/store/logo.jpg"}
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.style.display = "none";
                  if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                }}
                className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 object-cover rounded-xl border border-slate-300 dark:border-slate-700 bg-surface-container shadow-xs group-hover:border-primary/40 transition-all"
              />
              <div className="w-7 h-7 sm:w-8 sm:h-8 md:w-9 md:h-9 rounded-xl border border-slate-300 dark:border-slate-700 bg-primary/10 text-primary hidden items-center justify-center font-bold text-xs">
                {store?.name ? store.name.charAt(0).toUpperCase() : "G"}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-secondary ring-2 ring-surface" />
            </div>

            {/* Store title & micro status */}
            <div
              onClick={() => onNavigate("boutique")}
              className="flex flex-col min-w-0 cursor-pointer"
            >
              <div className="flex items-center gap-1 sm:gap-1.5">
                <span className="font-semibold text-xs sm:text-sm md:text-[15px] text-on-surface tracking-tight truncate max-w-[85px] xs:max-w-[130px] sm:max-w-[200px] md:max-w-[260px]">
                  {getTabTitle()}
                </span>
                {store?.is_verified && (
                  <Icon name="verified" className="text-[14px] sm:text-[15px] text-secondary shrink-0" style={{ fontVariationSettings: "'FILL' 1" }} title="Boutique vérifiée" aria-hidden="true" />
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
          <div className="flex items-center gap-2 xs:gap-2.5 sm:gap-3 md:gap-3.5 shrink-0 ml-auto">
            {/* Explorer button (Boutique) */}
            {onOpenExplorer && (
              <button
                onClick={onOpenExplorer}
                className="h-8.5 sm:h-9.5 px-2 xs:px-2.5 sm:px-3 rounded-xl bg-surface-secondary hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface text-xs font-medium border border-slate-300 dark:border-slate-700 flex items-center gap-1.5 transition-all active:scale-95 shrink-0 cursor-pointer"
                title="Explorer toutes les boutiques"
              >
                <Icon name="storefront" className="text-[20px] sm:text-[22px] text-primary" aria-hidden="true" />
                <span className="hidden md:inline">Toutes les Boutiques</span>
                <span className="hidden sm:inline md:hidden">Boutiques</span>
              </button>
            )}

            {/* Persona mode toggle ONLY when owner authenticated AND owns this store */}
            {authStatus?.is_authenticated && isCurrentStoreOwner && (
              <button
                onClick={onToggleMode}
                className={`h-8.5 sm:h-9.5 px-2.5 sm:px-3 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all active:scale-95 border cursor-pointer ${
                  mode === "owner"
                    ? "bg-secondary/15 text-secondary border-secondary/30"
                    : "bg-primary/15 text-primary border-primary/30"
                }`}
                title={mode === "owner" ? "Basculer en vue client" : "Basculer en vue gestion"}
              >
                <Icon name={mode === "owner" ? "visibility" : "admin_panel_settings"} className="text-[17px] sm:text-[18px]" />
                <span className="hidden sm:inline">{mode === "owner" ? "Vue Client" : "Vue Admin"}</span>
              </button>
            )}

            {/* Customer Quick Auth / Profile in client mode */}
            {mode === "client" && !authStatus?.is_authenticated && (
              customer ? (
                <button
                  onClick={() => onNavigate("reglages")}
                  className="flex items-center gap-1.5 h-8.5 sm:h-9.5 pl-1.5 pr-2.5 sm:pr-3 rounded-xl bg-surface-secondary hover:bg-surface-container-highest border border-slate-300 dark:border-slate-700 transition-all shrink-0 cursor-pointer"
                  title={`Compte de ${customer.name}`}
                >
                  <div className="w-6.5 h-6.5 sm:w-7 sm:h-7 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {customer.name?.slice(0, 1).toUpperCase() || "C"}
                  </div>
                  <span className="text-xs font-medium text-on-surface hidden sm:inline max-w-[85px] truncate">
                    {customer.name}
                  </span>
                </button>
              ) : (
                <button
                  onClick={onOpenCustomerAuth}
                  className="h-8.5 sm:h-9.5 px-2.5 sm:px-3 rounded-xl bg-primary hover:brightness-105 text-white text-xs font-semibold shadow-xs transition-all active:scale-95 flex items-center gap-1.5 shrink-0 cursor-pointer"
                  title="Connexion ou Inscription rapide"
                >
                  <Icon name="account_circle" className="text-[20px] sm:text-[22px]" />
                  <span className="hidden xs:inline">Connexion</span>
                </button>
              )
            )}

            {/* Authenticated Owner Avatar & Menu */}
            {authStatus?.is_authenticated && (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="relative flex items-center justify-center p-0.5 rounded-xl border border-subtle hover:border-secondary/50 transition-colors shrink-0 cursor-pointer"
                  title={authStatus?.owner_name || "Gérante"}
                >
                  <img
                    alt="Profil Commerçante"
                    src={getMediaUrl(store?.avatar_url) || "/media/store/awa_portrait.jpg"}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.style.display = "none";
                      if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                    }}
                    className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-lg object-cover"
                  />
                  <div className="w-8.5 h-8.5 sm:w-9 sm:h-9 rounded-lg bg-secondary/20 text-secondary hidden items-center justify-center font-bold text-xs">
                    {authStatus?.owner_name ? authStatus.owner_name.charAt(0).toUpperCase() : "M"}
                  </div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-secondary ring-1 ring-surface" />
                </button>

                {showProfileMenu && (
                  <div className="absolute right-0 mt-2 w-56 bg-surface border border-subtle rounded-2xl shadow-dropdown p-1.5 z-50 text-xs animate-fade-in divide-y divide-subtle">
                    <div className="px-3 py-2">
                      <p className="font-semibold text-on-surface truncate">{authStatus.owner_name || "Commerçante"}</p>
                      <p className="text-[11px] text-secondary font-medium">
                        {isCurrentStoreOwner ? "Gérant de cette boutique" : "Commerçant GotoShop"}
                      </p>
                      {!isCurrentStoreOwner && (
                        <span className="inline-block mt-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                          Visite en tant que client
                        </span>
                      )}
                    </div>

                    <div className="py-1 space-y-0.5">
                      {isCurrentStoreOwner ? (
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            onToggleMode();
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-secondary flex items-center gap-2 text-on-surface"
                        >
                          <Icon name={mode === "owner" ? "smartphone" : "store"} className="text-[16px] text-secondary" />
                          <span>{mode === "owner" ? "Passer en vue client" : "Passer en gestion"}</span>
                        </button>
                      ) : onGoToMyStore ? (
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            onGoToMyStore();
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl bg-secondary/10 hover:bg-secondary/20 flex items-center gap-2 text-secondary font-semibold"
                        >
                          <Icon name="storefront" className="text-[16px]" />
                          <span>Accéder à ma boutique</span>
                        </button>
                      ) : null}

                      {isCurrentStoreOwner && onOpenQrModal && (
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            onOpenQrModal();
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-secondary flex items-center gap-2 text-on-surface"
                        >
                          <Icon name="qr_code_2" className="text-[16px] text-primary" />
                          <span>QR Code &amp; Impression</span>
                        </button>
                      )}

                      {isCurrentStoreOwner && onOpenSubscription && (
                        <button
                          onClick={() => {
                            setShowProfileMenu(false);
                            onOpenSubscription();
                          }}
                          className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-secondary flex items-center gap-2 text-on-surface"
                        >
                          <Icon name="workspace_premium" className="text-[16px] text-amber-500" />
                          <span>Abonnement SaaS</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          if (onOpenStoreSwitcher) onOpenStoreSwitcher();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-secondary flex items-center gap-2 text-on-surface"
                      >
                        <Icon name="storefront" className="text-[16px] text-primary" />
                        <span>Changer de boutique</span>
                      </button>

                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onOpenChangePassword();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-secondary flex items-center gap-2 text-on-surface"
                      >
                        <Icon name="key" className="text-[16px] text-on-surface-variant" />
                        <span>Mot de passe</span>
                      </button>
                    </div>

                    <div className="pt-1">
                      <button
                        onClick={() => {
                          setShowProfileMenu(false);
                          onLogout();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-red-500/10 flex items-center gap-2 text-red-500 font-medium"
                      >
                        <Icon name="logout" className="text-[16px]" />
                        <span>Déconnexion</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Notification Bell with unread counter */}
            {onOpenNotifications && (
              <NotificationBell
                mode={mode}
                customer={customer}
                store={store}
                onClick={onOpenNotifications}
              />
            )}

            {/* Direct Theme Toggle button in header - hidden on extra narrow devices to prevent overflow */}
            <div className="hidden xs:flex">
              <ThemeToggle />
            </div>

            {/* More options menu button (...) */}
            <div className="relative">
              <button
                onClick={() => setShowToolsMenu(!showToolsMenu)}
                aria-label="Options"
                className={`w-8.5 h-8.5 sm:w-9.5 sm:h-9.5 rounded-xl flex items-center justify-center transition-all active:scale-95 border cursor-pointer ${
                  showToolsMenu
                    ? "bg-surface-secondary text-on-surface border-strong"
                    : "bg-surface-secondary hover:bg-surface-container-highest text-on-surface-variant hover:text-on-surface border-slate-300 dark:border-slate-700"
                }`}
                title="Options et outils"
              >
                <Icon name={showToolsMenu ? "close" : "more_vert"} className="text-[22px] sm:text-[24px]" />
              </button>

              {showToolsMenu && (
                <div className="absolute right-0 mt-2 w-60 bg-surface border border-subtle rounded-2xl shadow-dropdown p-1.5 z-50 text-xs animate-fade-in divide-y divide-subtle">
                  {/* Theme Switcher Row in Tools Menu */}
                  <div className="px-3 py-2 flex items-center justify-between">
                    <span className="text-xs text-on-surface-variant font-medium">Thème d'affichage</span>
                    <ThemeToggle variant="segmented" />
                  </div>

                  <div className="py-1 space-y-0.5">
                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        onShare();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-secondary flex items-center gap-2.5 text-on-surface transition-colors"
                    >
                      <Icon name="share" className="text-[16px] text-primary" />
                      <span>Partager la vitrine</span>
                    </button>

                    {onOpenMyStores && (
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          onOpenMyStores();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-secondary flex items-center gap-2.5 text-on-surface transition-colors"
                      >
                        <Icon name="loyalty" className="text-[16px] text-primary" />
                        <span>Mes Boutiques</span>
                      </button>
                    )}

                    {onOpenQrModal && (
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          onOpenQrModal();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-secondary flex items-center gap-2.5 text-on-surface transition-colors"
                      >
                        <Icon name="qr_code_2" className="text-[16px] text-secondary" />
                        <span>QR Code &amp; Impression</span>
                      </button>
                    )}

                    {onOpenExplorer && (
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          onOpenExplorer();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-secondary flex items-center gap-2.5 text-on-surface transition-colors"
                      >
                        <Icon name="grid_view" className="text-[16px] text-primary" />
                        <span>Galerie des boutiques</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        onOpenStoreSwitcher();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-secondary flex items-center gap-2.5 text-on-surface transition-colors"
                    >
                      <Icon name="storefront" className="text-[16px] text-secondary" />
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
                      <Icon name="add_business" className="text-[16px]" />
                      <span>Ouvrir ma boutique</span>
                    </button>

                    {authStatus?.is_authenticated && !isCurrentStoreOwner && onGoToMyStore && (
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          onGoToMyStore();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl bg-secondary/10 hover:bg-secondary/20 flex items-center gap-2.5 text-secondary font-semibold transition-colors"
                      >
                        <Icon name="storefront" className="text-[16px]" />
                        <span>Accéder à ma boutique</span>
                      </button>
                    )}

                    {!authStatus?.is_authenticated && (
                      <button
                        onClick={() => {
                          setShowToolsMenu(false);
                          onOpenLogin();
                        }}
                        className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-secondary flex items-center gap-2.5 text-on-surface-variant hover:text-on-surface transition-colors"
                      >
                        <Icon name="shield_person" className="text-[16px]" />
                        <span>Espace Commerçant</span>
                      </button>
                    )}

                    <button
                      onClick={() => {
                        setShowToolsMenu(false);
                        onOpenSuperAdmin();
                      }}
                      className="w-full text-left px-3 py-2 rounded-xl hover:bg-surface-secondary flex items-center gap-2.5 text-on-surface-variant hover:text-on-surface transition-colors"
                    >
                      <Icon name="hub" className="text-[16px] text-amber-500" />
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
