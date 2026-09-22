import React, { useState, useEffect } from "react";
import {
  fetchStore,
  fetchCategories,
  fetchProducts,
  fetchChannels,
  trackVisit,
  fetchAuthStatus,
  logoutOwner,
  fetchCustomerProfile,
  fetchCustomerOrders,
  clearCustomerToken,
  getLocalGuestOrders,
  linkGuestOrdersToAccount,
  clearLocalGuestOrders,
  deleteProduct,
  fetchPublicStores,
  FALLBACK_PUBLIC_STORES,
} from "./api/client";
import Header from "./components/Header";
import BottomNav from "./components/BottomNav";
import VitrinePage from "./components/VitrinePage";
import TunnelHandoffModal from "./components/TunnelHandoffModal";
import CommandesPage from "./components/CommandesPage";
import StatsPage from "./components/StatsPage";
import ReglagesPage from "./components/ReglagesPage";
import ConfirmTokenPage from "./components/ConfirmTokenPage";
import SplashScreen from "./components/SplashScreen";
import LoginModal from "./components/LoginModal";
import ChangePasswordModal from "./components/ChangePasswordModal";
import CustomerAuthModal from "./components/CustomerAuthModal";
import ClientCommandesPage from "./components/ClientCommandesPage";
import ClientStatsPage from "./components/ClientStatsPage";
import ClientProfilePage from "./components/ClientProfilePage";
import SuperAdminDashboard from "./components/SuperAdminDashboard";
import StoreSwitcherModal from "./components/StoreSwitcherModal";
import SubscriptionModal from "./components/SubscriptionModal";
import StoreExplorerPage from "./components/StoreExplorerPage";
import { getActiveStoreSlug, setActiveStoreSlug } from "./api/client";

export default function App() {
  const [store, setStore] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeTab, setActiveTab] = useState("boutique");
  const [tunnelProduct, setTunnelProduct] = useState(null);
  const [tunnelInitialChannel, setTunnelInitialChannel] = useState("WHATSAPP");
  const [tunnelInitialColor, setTunnelInitialColor] = useState("Bleu Nuit");
  const [confirmToken, setConfirmToken] = useState(null);
  const [loading, setLoading] = useState(true);

  // Multi-Store & Super-Admin state
  const [isSuperAdminOpen, setIsSuperAdminOpen] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      return p.get("view") === "super-admin" || window.location.pathname.startsWith("/super-admin");
    }
    return false;
  });
  const [isStoreSwitcherOpen, setIsStoreSwitcherOpen] = useState(false);

  // Store Explorer / Discovery view mode: "explorer" | "store"
  const [viewMode, setViewMode] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.has("store") || p.has("slug") || p.has("s")) return "store";
      const pathname = window.location.pathname;
      if (pathname.match(/^\/(?:store|boutique|s)\//)) return "store";
    }
    return "explorer";
  });
  const [publicStores, setPublicStores] = useState(FALLBACK_PUBLIC_STORES);
  const [publicStoresLoading, setPublicStoresLoading] = useState(false);

  // Persona Mode: "client" | "owner"
  const [appMode, setAppMode] = useState("client");

  // Customer Portal State
  const [customer, setCustomer] = useState(null);
  const [isCustomerAuthOpen, setIsCustomerAuthOpen] = useState(false);
  const [clientOrdersCount, setClientOrdersCount] = useState(0);

  // Splash Screen state
  const [showSplash, setShowSplash] = useState(true);

  // Owner Authentication states
  const [authStatus, setAuthStatus] = useState({
    is_authenticated: false,
    must_change_password: true,
    owner_name: null,
  });
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [pendingAdminTab, setPendingAdminTab] = useState(null);

  // Subscription Modal (Onboarding / Renewal)
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [subModalMode, setSubModalMode] = useState("NEW_STORE");

  // Cart state
  const [cart, setCart] = useState([]);

  // Toast state
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 2500);
  };

  const loadAllData = async () => {
    try {
      setLoading(true);
      const [s, cats, prods, chs] = await Promise.all([
        fetchStore(),
        fetchCategories(),
        fetchProducts(),
        fetchChannels(),
      ]);
      setStore(s);
      setCategories(cats);
      setProducts(prods);
      setChannels(chs);

      // Cart remains empty until customer explicitly clicks to add a product
    } catch (e) {
      console.warn("Erreur de synchronisation des données serveur :", e);
    } finally {
      setLoading(false);
    }
  };

  const checkAuth = async () => {
    try {
      const status = await fetchAuthStatus();
      setAuthStatus(status);
      if (status.is_authenticated && status.must_change_password) {
        setIsChangePasswordOpen(true);
      }
    } catch (e) {
      console.error("Auth check failed:", e);
    }
  };

  const loadCustomer = async () => {
    try {
      const profile = await fetchCustomerProfile();
      if (profile) {
        setCustomer(profile);
        const orders = await fetchCustomerOrders();
        setClientOrdersCount(orders.length);
      } else {
        const guestOrders = getLocalGuestOrders();
        setClientOrdersCount(guestOrders.length);
      }
    } catch (e) {
      console.error("Customer profile check failed:", e);
      const guestOrders = getLocalGuestOrders();
      setClientOrdersCount(guestOrders.length);
    }
  };

  useEffect(() => {
    // Check URL parameters for standalone confirmation link (?token=xxx)
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get("token") || urlParams.get("confirm");
    if (tokenParam) {
      setConfirmToken(tokenParam);
      setActiveTab("confirm");
    }

    // Auto-track campaign visits from URL parameters (?src=tiktok_bio, etc.)
    const srcParam = urlParams.get("src") || urlParams.get("source");
    if (srcParam) {
      trackVisit(srcParam);
    }

    checkAuth();
    loadCustomer();
    loadPublicStores();
    loadAllData();
  }, []);

  const loadPublicStores = async () => {
    try {
      setPublicStoresLoading(true);
      const list = await fetchPublicStores();
      if (list && list.length > 0) {
        setPublicStores(list);
      }
    } catch (e) {
      console.error("Erreur chargement boutiques publiques:", e);
    } finally {
      setPublicStoresLoading(false);
    }
  };

  // Synchronize dynamic store theme colors configured by merchant
  useEffect(() => {
    if (store) {
      // Synchronize dynamic browser tab title: "ShopChat + [host]"
      if (typeof window !== "undefined") {
        let hostStr = window.location.hostname || "localhost";
        if (hostStr === "localhost" || hostStr === "127.0.0.1") {
          if (store.slug) {
            hostStr = `${store.slug}.localhost`;
          }
        }
        document.title = `ShopChat + ${hostStr}`;
      }

      if (store.is_custom_theme_active) {
        if (store.primary_color) {
          document.documentElement.style.setProperty("--color-primary", store.primary_color);
          document.documentElement.style.setProperty("--color-primary-container", store.primary_color);
        }
        if (store.secondary_color) {
          document.documentElement.style.setProperty("--color-secondary", store.secondary_color);
          document.documentElement.style.setProperty("--color-secondary-container", store.secondary_color);
        }
      } else {
        document.documentElement.style.removeProperty("--color-primary");
        document.documentElement.style.removeProperty("--color-primary-container");
        document.documentElement.style.removeProperty("--color-secondary");
        document.documentElement.style.removeProperty("--color-secondary-container");
      }
    }
  }, [store?.is_custom_theme_active, store?.primary_color, store?.secondary_color]);

  const handleSelectTab = (tab) => {
    // When in owner mode, protect admin screens
    if (appMode === "owner" && (tab === "commandes" || tab === "stats" || tab === "reglages")) {
      if (!authStatus.is_authenticated) {
        setPendingAdminTab(tab);
        setIsLoginOpen(true);
        showToast("Connexion propriétaire requise pour cet espace");
        return;
      }
      if (authStatus.must_change_password) {
        setIsChangePasswordOpen(true);
        showToast("Modification obligatoire du mot de passe requise");
        return;
      }
    }
    setActiveTab(tab);
  };

  const handleToggleMode = () => {
    if (authStatus.is_authenticated) {
      const nextMode = appMode === "owner" ? "client" : "owner";
      setAppMode(nextMode);
      showToast(`Basculé en mode ${nextMode === "owner" ? "Commerçante" : "Client"} 🔄`);
    } else {
      setIsLoginOpen(true);
    }
  };

  const handleLoginSuccess = (loginData) => {
    setAuthStatus({
      is_authenticated: true,
      must_change_password: loginData.must_change_password,
      owner_name: loginData.owner_name,
      email: loginData.email,
    });
    setIsLoginOpen(false);
    setAppMode("owner");

    if (loginData.must_change_password) {
      setIsChangePasswordOpen(true);
      showToast("Changement de mot de passe obligatoire pour continuer");
    } else if (pendingAdminTab) {
      setActiveTab(pendingAdminTab);
      setPendingAdminTab(null);
    } else {
      setActiveTab("commandes");
    }
  };

  const handleChangePasswordSuccess = () => {
    setAuthStatus((prev) => ({
      ...prev,
      must_change_password: false,
    }));
    setIsChangePasswordOpen(false);
    showToast("Votre compte est maintenant hyper-sécurisé !");
    if (pendingAdminTab) {
      setActiveTab(pendingAdminTab);
      setPendingAdminTab(null);
    }
  };

  const handleLogout = async () => {
    await logoutOwner();
    setAuthStatus({
      is_authenticated: false,
      must_change_password: true,
      owner_name: null,
      email: null,
    });
    setAppMode("client");
    showToast("Déconnexion propriétaire réussie");
    setActiveTab("boutique");
  };

  const handleCustomerAuthSuccess = async (newCustomer) => {
    setCustomer(newCustomer);
    setIsCustomerAuthOpen(false);
    try {
      const localGuestOrders = getLocalGuestOrders();
      if (localGuestOrders && localGuestOrders.length > 0) {
        const orderIds = localGuestOrders.map((o) => o.id).filter(Boolean);
        if (orderIds.length > 0) {
          await linkGuestOrdersToAccount(orderIds);
          clearLocalGuestOrders();
          showToast(`🎉 ${orderIds.length} commande(s) invitée(s) rattachée(s) à votre compte !`);
        }
      }
      const orders = await fetchCustomerOrders();
      setClientOrdersCount(orders.length);
    } catch (e) {
      console.error("Linking guest orders failed:", e);
    }
  };

  const handleOpenTunnel = (product, channel = "WHATSAPP", color = "Bleu Nuit") => {
    setTunnelProduct(product);
    setTunnelInitialChannel(channel);
    setTunnelInitialColor(color);
    setActiveTab("tunnel");
  };

  const handleAddToCart = (product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1 }];
      }
    });
    showToast(`Ajouté : ${product.name}`);
  };

  const handleCheckoutCart = () => {
    if (cart.length === 0) {
      showToast("Votre panier est vide");
      return;
    }
    const hero = products.find((p) => p.is_hero_deal) || products[0];
    handleOpenTunnel(hero, "WHATSAPP");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: store?.name || "Boutique",
        text: store?.tagline || "Découvrez nos offres exclusives !",
        url: window.location.origin,
      }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(window.location.origin);
      showToast("Lien de la boutique copié !");
    }
  };

  const handleProductUpdated = (updated) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    loadAllData();
  };

  const handleProductDeleted = async (productId) => {
    setProducts((prev) => prev.filter((p) => p.id !== productId));
    try {
      await deleteProduct(productId, true);
      showToast("Produit supprimé de la boutique !");
    } catch (e) {
      // Handled
    }
    loadAllData();
  };

  const handleSwitchStore = async (slug, openAdmin = false) => {
    setActiveStoreSlug(slug);
    setIsSuperAdminOpen(false);
    setIsStoreSwitcherOpen(false);
    setViewMode("store");
    try {
      const url = new URL(window.location);
      if (slug) url.searchParams.set("store", slug);
      else url.searchParams.delete("store");
      if (openAdmin) url.searchParams.set("view", "admin");
      else url.searchParams.delete("view");
      window.history.pushState({}, "", url);
    } catch (e) {}

    await loadAllData();
    if (openAdmin) {
      setAppMode("owner");
      setActiveTab("commandes");
    } else {
      setAppMode("client");
      setActiveTab("boutique");
    }
    showToast("Boutique chargée avec succès !");
  };

  const handleSelectStoreFromExplorer = async (slug) => {
    setActiveStoreSlug(slug);
    setViewMode("store");
    try {
      const url = new URL(window.location);
      url.searchParams.set("store", slug);
      window.history.pushState({}, "", url);
    } catch (e) {}
    await loadAllData();
    setActiveTab("boutique");
    showToast("Boutique chargée avec succès !");
  };

  const handleOpenExplorer = () => {
    setViewMode("explorer");
    try {
      const url = new URL(window.location);
      url.searchParams.delete("store");
      window.history.pushState({}, "", url);
    } catch (e) {}
    loadPublicStores();
  };

  if (isSuperAdminOpen) {
    return (
      <SuperAdminDashboard
        onClose={() => setIsSuperAdminOpen(false)}
        onSwitchStore={handleSwitchStore}
      />
    );
  }

  // If viewMode is "explorer", show the Store Explorer Page after splash screen
  if (!showSplash && viewMode === "explorer") {
    return (
      <div className="bg-surface font-body-md text-on-surface flex flex-col min-h-screen antialiased selection:bg-primary-container selection:text-on-primary-container">
        <StoreExplorerPage
          stores={publicStores}
          loading={publicStoresLoading}
          onSelectStore={handleSelectStoreFromExplorer}
          customer={customer}
          onOpenCustomerAuth={() => setIsCustomerAuthOpen(true)}
          onOpenRegisterStore={() => {
            setSubModalMode("NEW_STORE");
            setIsSubscriptionModalOpen(true);
          }}
          onOpenOwnerLogin={() => setIsLoginOpen(true)}
          onOpenSuperAdmin={() => setIsSuperAdminOpen(true)}
        />

        {/* Customer Login / Register Modal */}
        <CustomerAuthModal
          isOpen={isCustomerAuthOpen}
          onClose={() => setIsCustomerAuthOpen(false)}
          onSuccess={handleCustomerAuthSuccess}
          showToast={showToast}
        />

        {/* Owner Login Modal */}
        <LoginModal
          isOpen={isLoginOpen}
          onClose={() => setIsLoginOpen(false)}
          onLoginSuccess={handleLoginSuccess}
          showToast={showToast}
        />

        {/* Global Subscription Modal */}
        <SubscriptionModal
          isOpen={isSubscriptionModalOpen}
          onClose={() => setIsSubscriptionModalOpen(false)}
          mode={subModalMode}
          initialStore={store}
          onSuccess={() => {
            showToast("Demande d'abonnement transmise ! Vos identifiants vous seront délivrés dès vérification.");
          }}
        />

        {/* Interactive Feedback Toast */}
        <div
          className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-full bg-secondary-container px-4 py-2 text-on-secondary font-label-md text-label-md shadow-2xl flex items-center gap-2 pointer-events-none transition-all duration-300 ${
            toastVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface font-body-md text-on-surface flex flex-col min-h-screen antialiased selection:bg-primary-container selection:text-on-primary-container">
      {/* Animated Splash Screen */}
      {showSplash && (
        <SplashScreen store={store} onFinished={() => setShowSplash(false)} />
      )}

      {/* Universal Fixed Header */}
      <Header
        store={store}
        activeTab={activeTab}
        onShare={handleShare}
        onNavigate={handleSelectTab}
        mode={appMode}
        onToggleMode={handleToggleMode}
        authStatus={authStatus}
        customer={customer}
        onOpenCustomerAuth={() => setIsCustomerAuthOpen(true)}
        onOpenLogin={() => setIsLoginOpen(true)}
        onOpenChangePassword={() => setIsChangePasswordOpen(true)}
        onLogout={handleLogout}
        onOpenExplorer={handleOpenExplorer}
        onOpenStoreSwitcher={() => setIsStoreSwitcherOpen(true)}
        onOpenSuperAdmin={() => setIsSuperAdminOpen(true)}
        onOpenRegisterStore={() => {
          setSubModalMode("NEW_STORE");
          setIsSubscriptionModalOpen(true);
        }}
        onOpenSubscription={() => {
          setSubModalMode("RENEWAL");
          setIsSubscriptionModalOpen(true);
        }}
      />

      {/* Main Screen Container */}
      <main className="flex flex-col relative w-full pt-16 px-margin bg-surface flex-grow max-w-lg mx-auto">
        {activeTab === "boutique" && (
          <VitrinePage
            store={store}
            categories={categories}
            products={products.filter((p) => !selectedCategory || p.category_id === selectedCategory)}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            onOpenTunnel={handleOpenTunnel}
            cart={cart}
            onAddToCart={handleAddToCart}
            onCheckoutCart={handleCheckoutCart}
            showToast={showToast}
            customer={customer}
            mode={appMode}
            onOpenCustomerAuth={() => setIsCustomerAuthOpen(true)}
            onProductUpdated={handleProductUpdated}
            onProductDeleted={handleProductDeleted}
          />
        )}

        {activeTab === "tunnel" && (
          <TunnelHandoffModal
            store={store}
            product={tunnelProduct || products[0]}
            customer={customer}
            initialChannel={tunnelInitialChannel}
            initialColor={tunnelInitialColor}
            onClose={() => setActiveTab("boutique")}
            showToast={showToast}
            onOrderCreated={(intent) => {
              showToast(`Commande #${intent.reference_code} enregistrée en base !`);
              setClientOrdersCount((prev) => prev + 1);
            }}
            onOpenCustomerAuth={() => setIsCustomerAuthOpen(true)}
            onNavigateToOrders={() => setActiveTab("commandes")}
          />
        )}

        {/* Tab 2: Commandes */}
        {activeTab === "commandes" && (
          appMode === "owner" ? (
            <CommandesPage
              store={store}
              categories={categories}
              showToast={showToast}
              onSaleConfirmed={() => loadAllData()}
              onProductCreated={() => loadAllData()}
            />
          ) : (
            <ClientCommandesPage
              customer={customer}
              onOpenAuth={() => setIsCustomerAuthOpen(true)}
              onNavigateToShop={() => setActiveTab("boutique")}
              showToast={showToast}
            />
          )
        )}

        {/* Tab 3: Stats / Avantages */}
        {activeTab === "stats" && (
          appMode === "owner" ? (
            <StatsPage
              store={store}
              showToast={showToast}
              onNavigateToCatalog={() => setActiveTab("boutique")}
              onProductUpdated={() => loadAllData()}
              onProductDeleted={() => loadAllData()}
            />
          ) : (
            <ClientStatsPage
              customer={customer}
              onOpenAuth={() => setIsCustomerAuthOpen(true)}
              onNavigateToShop={() => setActiveTab("boutique")}
              showToast={showToast}
            />
          )
        )}

        {/* Tab 4: Réglages / Profil */}
        {activeTab === "reglages" && (
          appMode === "owner" ? (
            <ReglagesPage
              store={store}
              channels={channels}
              onStoreUpdated={(updated) => setStore(updated)}
              onChannelsUpdated={(updatedList) => setChannels(updatedList)}
              onOpenChangePassword={() => setIsChangePasswordOpen(true)}
              onLogout={handleLogout}
              showToast={showToast}
            />
          ) : (
            <ClientProfilePage
              customer={customer}
              onUpdateCustomer={(c) => {
                setCustomer(c);
                showToast("Profil client mis à jour");
              }}
              onLogoutCustomer={() => {
                clearCustomerToken();
                setCustomer(null);
                setClientOrdersCount(0);
                showToast("Déconnexion client réussie");
              }}
              onOpenAuth={() => setIsCustomerAuthOpen(true)}
              onOpenOwnerLogin={() => setIsLoginOpen(true)}
              showToast={showToast}
            />
          )
        )}

        {activeTab === "confirm" && (
          <ConfirmTokenPage
            token={confirmToken || "demo_token"}
            onBackToStore={() => setActiveTab("boutique")}
            showToast={showToast}
          />
        )}
      </main>

      {/* Interactive Feedback Toast */}
      <div
        className={`fixed top-20 left-1/2 -translate-x-1/2 z-50 rounded-full bg-secondary-container px-4 py-2 text-on-secondary font-label-md text-label-md shadow-2xl flex items-center gap-2 pointer-events-none transition-all duration-300 ${
          toastVisible ? "opacity-100 scale-100" : "opacity-0 scale-95"
        }`}
      >
        <span className="material-symbols-outlined text-[18px]">check_circle</span>
        <span>{toastMessage}</span>
      </div>

      {/* Universal Fixed Bottom Nav */}
      {activeTab !== "tunnel" && activeTab !== "confirm" && (
        <BottomNav
          activeTab={activeTab}
          onSelectTab={handleSelectTab}
          mode={appMode}
          pendingCount={3}
          clientOrdersCount={clientOrdersCount}
        />
      )}

      {/* Owner Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        showToast={showToast}
      />

      {/* Mandatory Strong Password Change Modal */}
      {(isChangePasswordOpen || (authStatus.is_authenticated && authStatus.must_change_password && appMode === "owner" && (activeTab === "commandes" || activeTab === "stats" || activeTab === "reglages"))) && (
        <ChangePasswordModal
          isMandatory={authStatus.must_change_password}
          onClose={() => setIsChangePasswordOpen(false)}
          onSuccess={handleChangePasswordSuccess}
          showToast={showToast}
        />
      )}

      {/* Fast Customer Signup / Login Modal */}
      <CustomerAuthModal
        isOpen={isCustomerAuthOpen}
        onClose={() => setIsCustomerAuthOpen(false)}
        onSuccess={handleCustomerAuthSuccess}
        showToast={showToast}
      />

      {/* Multi-Store Switcher Modal */}
      <StoreSwitcherModal
        isOpen={isStoreSwitcherOpen}
        onClose={() => setIsStoreSwitcherOpen(false)}
        onSelectStore={(slug) => handleSwitchStore(slug, false)}
        onOpenExplorer={() => {
          setIsStoreSwitcherOpen(false);
          handleOpenExplorer();
        }}
        onOpenSuperAdmin={() => {
          setIsStoreSwitcherOpen(false);
          setIsSuperAdminOpen(true);
        }}
      />

      {/* Global Subscription & Onboarding Modal */}
      <SubscriptionModal
        isOpen={isSubscriptionModalOpen}
        onClose={() => setIsSubscriptionModalOpen(false)}
        mode={subModalMode}
        initialStore={store}
        onSuccess={() => {
          showToast("Demande d'abonnement transmise ! Vos identifiants vous seront délivrés dès vérification.");
        }}
      />
    </div>
  );
}
