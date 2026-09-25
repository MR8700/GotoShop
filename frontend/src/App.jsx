import Icon from "./components/Icon";
import React, { useState, useEffect } from "react";
import {
  fetchStore,
  fetchCategories,
  fetchProducts,
  fetchChannels,
  trackVisit,
  fetchAuthStatus,
  setAuthToken,
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
  fetchConversations,
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
import ChatPage from "./components/ChatPage";
import ConversationalOrderModal from "./components/ConversationalOrderModal";
import NotificationDrawer from "./components/NotificationDrawer";
import StoreQrModal from "./components/StoreQrModal";
import MyStoresPage from "./components/MyStoresPage";
import DecisionSupportWidget from "./components/DecisionSupportWidget";
import { getActiveStoreSlug, setActiveStoreSlug, trackQrScan } from "./api/client";

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

  // Conversational Commerce State
  const [conversationalOrderProduct, setConversationalOrderProduct] = useState(null);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

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
  const [lastVisitedStore, setLastVisitedStore] = useState(() => {
    try {
      const saved = safeStorage.getItem("gotoshop_last_visited_store");
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

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

  // New Features: Notification Drawer & Store QR Modal
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [isStoreQrModalOpen, setIsStoreQrModalOpen] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 2500);
  };

  const loadAllData = async (targetSlug = null) => {
    try {
      setLoading(true);
      const activeSlug = targetSlug || getActiveStoreSlug();
      const [s, cats, prods, chs] = await Promise.all([
        fetchStore(activeSlug),
        fetchCategories(activeSlug),
        fetchProducts(null, activeSlug),
        fetchChannels(activeSlug),
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

    // Auto-track QR scan if open via QR code (?qr=1)
    const qrParam = urlParams.get("qr");
    const initialSlug = urlParams.get("store") || urlParams.get("slug") || urlParams.get("s");
    if (qrParam && initialSlug) {
      trackQrScan(initialSlug);
    }

    // Native browser Back/Forward navigation listener (popstate)
    const handlePopState = () => {
      // 1. Close any open overlays/modals so back action dismisses them
      setIsSubscriptionModalOpen(false);
      setIsStoreSwitcherOpen(false);
      setIsCustomerAuthOpen(false);
      setIsLoginOpen(false);
      setIsChangePasswordOpen(false);
      setIsNotificationDrawerOpen(false);
      setIsStoreQrModalOpen(false);

      const p = new URLSearchParams(window.location.search);
      const storeSlug = p.get("store") || p.get("slug") || p.get("s");
      const viewParam = p.get("view");
      const tabParam = p.get("tab");

      if (viewParam === "super-admin" || window.location.pathname.startsWith("/super-admin")) {
        setIsSuperAdminOpen(true);
        return;
      } else {
        setIsSuperAdminOpen(false);
      }

      if (storeSlug) {
        setViewMode("store");
        setActiveStoreSlug(storeSlug);
        loadAllData(storeSlug);
      } else {
        const match = window.location.pathname.match(/^\/(?:store|boutique|s)\/([^/]+)/);
        if (match) {
          setViewMode("store");
          setActiveStoreSlug(match[1]);
          loadAllData(match[1]);
        } else {
          setViewMode("explorer");
          setActiveStoreSlug("");
          loadPublicStores();
        }
      }

      if (viewParam === "admin") {
        setAppMode("owner");
        setActiveTab(tabParam || "commandes");
      } else {
        setAppMode("client");
        setActiveTab(tabParam || "boutique");
      }
    };

    window.addEventListener("popstate", handlePopState);

    checkAuth();
    loadCustomer();
    loadPublicStores();
    loadAllData();

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
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

  // Track and save the last visited store when in store mode
  useEffect(() => {
    if (store && store.slug && viewMode === "store") {
      const info = {
        slug: store.slug,
        name: store.name,
        logo_url: store.logo_url,
        delivery_city: store.delivery_city,
        tagline: store.tagline,
      };
      setLastVisitedStore(info);
      try {
        safeStorage.setItem("gotoshop_last_visited_store", JSON.stringify(info));
      } catch (e) {}
    }
  }, [store?.slug, store?.name, viewMode]);

  // Synchronize dynamic browser title ("GotoShop") & isolate boutique theme from explorer
  useEffect(() => {
    // 1. Dynamic browser tab title: "GotoShop" / "GotoShop • [Nom Boutique]"
    if (typeof window !== "undefined") {
      if (viewMode === "explorer") {
        document.title = "GotoShop";
      } else if (store?.name) {
        document.title = `GotoShop • ${store.name}`;
      } else {
        document.title = "GotoShop";
      }
    }

    // 2. Strict Theme Isolation: Reset boutique colors when on explorer/galerie
    if (viewMode === "explorer" || !store || !store.is_custom_theme_active) {
      document.documentElement.style.removeProperty("--color-primary");
      document.documentElement.style.removeProperty("--color-primary-container");
      document.documentElement.style.removeProperty("--color-secondary");
      document.documentElement.style.removeProperty("--color-secondary-container");
    } else if (store && store.is_custom_theme_active) {
      if (store.primary_color) {
        document.documentElement.style.setProperty("--color-primary", store.primary_color);
        document.documentElement.style.setProperty("--color-primary-container", store.primary_color);
      }
      if (store.secondary_color) {
        document.documentElement.style.setProperty("--color-secondary", store.secondary_color);
        document.documentElement.style.setProperty("--color-secondary-container", store.secondary_color);
      }
    }
  }, [viewMode, store?.name, store?.is_custom_theme_active, store?.primary_color, store?.secondary_color]);

  const loadUnreadChatCount = async () => {
    try {
      const res = await fetchConversations(store?.id || 1, appMode === "owner" ? "owner" : "client");
      if (res && res.conversations) {
        const total = res.conversations.reduce((acc, c) => acc + (c.unread_count || 0), 0);
        setUnreadChatCount(total);
      }
    } catch (e) {}
  };

  useEffect(() => {
    loadUnreadChatCount();
    const interval = setInterval(loadUnreadChatCount, 15000);
    return () => clearInterval(interval);
  }, [store?.id, appMode]);

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
    if (tab === "chat") {
      loadUnreadChatCount();
    }
    setActiveTab(tab);
    try {
      const url = new URL(window.location);
      url.searchParams.set("tab", tab);
      window.history.pushState({ tab }, "", url);
    } catch (e) {}
  };

  const handleNavigateAction = (urlStr) => {
    if (!urlStr) return;
    try {
      const parsed = new URL(urlStr, window.location.origin);
      const storeSlug = parsed.searchParams.get("store") || (parsed.pathname.match(/^\/(?:store|boutique)\/([^/?]+)/)?.[1]);
      const tabParam = parsed.searchParams.get("tab");
      const convParam = parsed.searchParams.get("conv");

      if (storeSlug && storeSlug !== store?.slug) {
        handleSwitchStore(storeSlug, false);
      }
      if (convParam) {
        setActiveConversationId(convParam);
        handleSelectTab("chat");
      } else if (tabParam) {
        handleSelectTab(tabParam);
      }
    } catch (e) {
      console.warn("Invalid action url:", urlStr);
    }
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

  const handleAddToCart = (product, customVariant = null, customQuantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + (customQuantity || 1) } : item
        );
      } else {
        return [
          ...prev,
          {
            id: product.id,
            product_id: product.id,
            name: product.name,
            price: (customVariant && customVariant.price_override) || product.price || 0,
            quantity: customQuantity || 1,
            unit: product.sales_unit || "PIECE",
            unit_label: product.sales_unit_label || "pièce",
            pricing_model: product.pricing_model || "FIXED_PER_UNIT",
            primary_image_url: product.primary_image_url,
            variant_id: customVariant ? customVariant.id : null,
            variant_name: customVariant ? customVariant.name : (product.variants?.[0]?.name || null),
            customization_text: "",
            is_customizable: Boolean(product.is_customizable),
            store_id: product.store_id || store?.id,
          },
        ];
      }
    });
    showToast(`Ajouté au panier : ${product.name}`);
  };

  const handleUpdateCartQuantity = (productId, delta) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.id === productId ? { ...item, quantity: item.quantity + delta } : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const handleRemoveFromCart = (productId) => {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  };

  const handleUpdateCartCustomization = (productId, text) => {
    setCart((prev) =>
      prev.map((item) => (item.id === productId ? { ...item, customization_text: text } : item))
    );
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleOpenTunnel = (product = null, channel = "DIRECT", color = "Bleu Nuit") => {
    if (product) {
      setTunnelProduct(product);
      setCart((prev) => {
        if (!prev.find((it) => it.id === product.id)) {
          return [
            ...prev,
            {
              id: product.id,
              product_id: product.id,
              name: product.name,
              price: product.price || 0,
              quantity: 1,
              unit: product.sales_unit || "PIECE",
              unit_label: product.sales_unit_label || "pièce",
              primary_image_url: product.primary_image_url,
              variant_name: color || (product.variants?.[0]?.name || null),
              customization_text: "",
              is_customizable: Boolean(product.is_customizable),
              store_id: product.store_id || store?.id,
            },
          ];
        }
        return prev;
      });
    }
    setActiveTab("tunnel");
  };

  const handleCheckoutCart = () => {
    if (cart.length === 0) {
      showToast("Votre panier est vide");
      return;
    }
    setActiveTab("tunnel");
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

  const handleOpenConversationalOrder = (product) => {
    handleOpenTunnel(product);
  };

  const handleOpenChat = (conversationId = null) => {
    if (conversationId) {
      setActiveConversationId(conversationId);
    }
    setActiveTab("chat");
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

    await loadAllData(slug);
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
    await loadAllData(slug);
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

  const handleStoreRegistered = async (result, openAdmin = true) => {
    if (result?.slug) {
      if (result.access_token) {
        setAuthToken(result.access_token);
        setAuthStatus({
          is_authenticated: true,
          must_change_password: Boolean(result.must_change_password),
          owner_name: result.owner?.full_name || result.store_name,
          email: result.owner?.email,
        });
      }
      await handleSwitchStore(result.slug, openAdmin);
      await loadPublicStores();
      showToast(`🎉 Félicitations ! Votre boutique "${result.store_name || result.slug}" est ouverte !`);
      if (result.must_change_password && openAdmin) {
        setIsChangePasswordOpen(true);
      }
    } else {
      showToast("Demande d'abonnement transmise avec succès !");
    }
  };

  const handleOpenSubscriptionModal = (mode = "NEW_STORE") => {
    setSubModalMode(mode);
    setIsSubscriptionModalOpen(true);
    try {
      window.history.pushState({ modal: "subscription" }, "", window.location.href);
    } catch (e) {}
  };

  const handleCloseSubscriptionModal = () => {
    setIsSubscriptionModalOpen(false);
    try {
      if (window.history.state?.modal === "subscription") {
        window.history.back();
      }
    } catch (e) {}
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
          onOpenRegisterStore={() => handleOpenSubscriptionModal("NEW_STORE")}
          onOpenOwnerLogin={() => setIsLoginOpen(true)}
          onOpenSuperAdmin={() => setIsSuperAdminOpen(true)}
          lastVisitedStore={lastVisitedStore}
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
          onSuccess={handleStoreRegistered}
        />

        {/* Centralized Notification Drawer */}
        <NotificationDrawer
          isOpen={isNotificationDrawerOpen}
          onClose={() => setIsNotificationDrawerOpen(false)}
          mode={appMode}
          customer={customer}
          store={store}
          onNavigateAction={handleNavigateAction}
        />

        {/* Store QR & Professional Print Modal */}
        <StoreQrModal
          isOpen={isStoreQrModalOpen}
          onClose={() => setIsStoreQrModalOpen(false)}
          store={store}
          showToast={showToast}
        />

        {/* Interactive Feedback Toast */}
        <div
          className={`fixed top-5 left-1/2 -translate-x-1/2 z-[99999] rounded-full bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-4 py-2 text-xs font-semibold shadow-2xl flex items-center gap-2 pointer-events-none transition-all duration-300 border border-white/20 dark:border-black/20 ${
            toastVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2"
          }`}
        >
          <Icon name="check_circle" className="text-[18px] text-secondary" />
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
        onOpenRegisterStore={() => handleOpenSubscriptionModal("NEW_STORE")}
        onOpenSubscription={() => handleOpenSubscriptionModal("RENEWAL")}
        onOpenNotifications={() => setIsNotificationDrawerOpen(true)}
        onOpenQrModal={() => setIsStoreQrModalOpen(true)}
        onOpenMyStores={() => {
          setViewMode("store");
          handleSelectTab("my-stores");
        }}
      />

      {/* Main Screen Container */}
      <main className={`flex flex-col relative w-full pt-16 bg-surface flex-grow ${activeTab === "chat" ? "max-w-4xl px-2 sm:px-4" : "max-w-lg px-margin"} mx-auto`}>
        {/* Merchant Decision Support & Operational Priorities */}
        {appMode === "owner" && (activeTab === "commandes" || activeTab === "stats") && (
          <div className="w-full pt-2">
            <DecisionSupportWidget
              store={store}
              onNavigate={handleNavigateAction}
            />
          </div>
        )}

        {/* Tab: Mes Boutiques (Followed & Recent Access) */}
        {activeTab === "my-stores" && (
          <MyStoresPage
            customer={customer}
            onSelectStore={handleSelectStoreFromExplorer}
            onOpenExplorer={handleOpenExplorer}
            onOpenCustomerAuth={() => setIsCustomerAuthOpen(true)}
            showToast={showToast}
          />
        )}

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
            onOpenConversationalOrder={handleOpenConversationalOrder}
            onOpenChat={handleOpenChat}
            onOpenQrModal={() => setIsStoreQrModalOpen(true)}
          />
        )}

        {activeTab === "tunnel" && (
          <TunnelHandoffModal
            store={store}
            cart={cart}
            product={tunnelProduct || products[0]}
            customer={customer}
            onUpdateCartQuantity={handleUpdateCartQuantity}
            onRemoveFromCart={handleRemoveFromCart}
            onUpdateCartCustomization={handleUpdateCartCustomization}
            onClearCart={handleClearCart}
            onClose={() => handleSelectTab("boutique")}
            showToast={showToast}
            onOrderCreated={(order) => {
              showToast(`Commande #${order.order_number || order.reference_code} enregistrée en base !`);
              setClientOrdersCount((prev) => prev + 1);
              loadUnreadChatCount();
            }}
            onOpenCustomerAuth={() => setIsCustomerAuthOpen(true)}
            onNavigateToOrders={() => handleSelectTab("commandes")}
            onOpenChat={handleOpenChat}
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
              onOpenChat={handleOpenChat}
            />
          ) : (
            <ClientCommandesPage
              customer={customer}
              onOpenAuth={() => setIsCustomerAuthOpen(true)}
              onNavigateToShop={() => setActiveTab("boutique")}
              showToast={showToast}
              onOpenChat={handleOpenChat}
            />
          )
        )}

        {/* Tab: Chat & Messagerie */}
        {activeTab === "chat" && (
          <ChatPage
            store={store}
            customer={customer}
            initialConversationId={activeConversationId}
            appMode={appMode}
            onClose={() => setActiveTab("boutique")}
            showToast={showToast}
            onNavigateToOrder={() => {
              setActiveTab("commandes");
            }}
          />
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
        className={`fixed top-5 left-1/2 -translate-x-1/2 z-[99999] rounded-full bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 px-4 py-2 text-xs font-semibold shadow-2xl flex items-center gap-2 pointer-events-none transition-all duration-300 border border-white/20 dark:border-black/20 ${
          toastVisible ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-95 -translate-y-2"
        }`}
      >
        <Icon name="check_circle" className="text-[18px] text-secondary" />
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
          unreadChatCount={unreadChatCount}
        />
      )}

      {/* Conversational Order & Customization Modal */}
      {conversationalOrderProduct && (
        <ConversationalOrderModal
          store={store}
          product={conversationalOrderProduct}
          customer={customer}
          onClose={() => setConversationalOrderProduct(null)}
          showToast={showToast}
          onCustomerAuthenticated={(newCust) => handleCustomerAuthSuccess(newCust)}
          onOrderCreated={(order) => {
            setClientOrdersCount((prev) => prev + 1);
            loadUnreadChatCount();
          }}
          onOpenChat={(convId) => {
            setConversationalOrderProduct(null);
            handleOpenChat(convId);
          }}
        />
      )}

      {/* Owner Login Modal */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onOpenRegisterStore={() => {
          setIsLoginOpen(false);
          handleOpenSubscriptionModal("NEW_STORE");
        }}
        showToast={showToast}
      />

      {/* Mandatory Strong Password Change Modal */}
      {(isChangePasswordOpen || (authStatus.is_authenticated && authStatus.must_change_password && appMode === "owner" && (activeTab === "commandes" || activeTab === "stats" || activeTab === "reglages"))) && (
        <ChangePasswordModal
          isMandatory={authStatus.must_change_password}
          onClose={() => setIsChangePasswordOpen(false)}
          onSuccess={handleChangePasswordSuccess}
          onLogout={handleLogout}
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
        onClose={handleCloseSubscriptionModal}
        mode={subModalMode}
        initialStore={store}
        onSuccess={handleStoreRegistered}
      />

      {/* Centralized Notification Drawer */}
      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        mode={appMode}
        customer={customer}
        store={store}
        onNavigateAction={handleNavigateAction}
      />

      {/* Store QR & Professional Print Modal */}
      <StoreQrModal
        isOpen={isStoreQrModalOpen}
        onClose={() => setIsStoreQrModalOpen(false)}
        store={store}
        showToast={showToast}
      />
    </div>
  );
}
