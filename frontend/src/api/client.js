import {
  FALLBACK_PUBLIC_STORES,
  getFallbackStore,
  getFallbackCategories,
  getFallbackProducts,
  FALLBACK_SUBSCRIPTION_PUBLIC_INFO,
} from "./fallbackData";

export { FALLBACK_PUBLIC_STORES, FALLBACK_SUBSCRIPTION_PUBLIC_INFO };

const getApiBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  if (typeof window !== "undefined" && window.location) {
    if (window.location.port === "5173") {
      return `${window.location.protocol}//${window.location.hostname}:8000/api`;
    }
    return `${window.location.origin}/api`;
  }
  return "http://localhost:8000/api";
};

const getMediaBase = () => {
  if (import.meta.env.VITE_MEDIA_URL) return import.meta.env.VITE_MEDIA_URL;
  if (typeof window !== "undefined" && window.location) {
    if (window.location.port === "5173") {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
    return window.location.origin;
  }
  return "http://localhost:8000";
};

const API_BASE = getApiBase();
const MEDIA_BASE = getMediaBase();

export const detectSubdomainSlug = () => {
  if (typeof window === "undefined" || !window.location) return null;
  const hostname = window.location.hostname.toLowerCase();
  if (hostname === "localhost" || hostname === "127.0.0.1") return null;
  if (hostname.endsWith(".localhost")) {
    const sub = hostname.slice(0, -".localhost".length);
    if (sub && !["www", "admin", "superadmin", "api", "app"].includes(sub)) {
      return sub;
    }
  }
  const parts = hostname.split(".");
  if (parts.length >= 3) {
    const sub = parts[0];
    if (!["www", "admin", "superadmin", "api", "app"].includes(sub)) {
      return sub;
    }
  }
  return null;
};

export const getActiveStoreSlug = () => {
  if (typeof window === "undefined") return "faso-danfani";
  const params = new URLSearchParams(window.location.search);
  const storeParam = params.get("store") || params.get("slug") || params.get("s");
  if (storeParam) {
    localStorage.setItem("conversastore_active_slug", storeParam);
    return storeParam;
  }
  const pathname = window.location.pathname;
  const storePathMatch = pathname.match(/^\/(?:store|boutique|s)\/([a-zA-Z0-9_-]+)/);
  if (storePathMatch && storePathMatch[1]) {
    localStorage.setItem("conversastore_active_slug", storePathMatch[1]);
    return storePathMatch[1];
  }
  const sub = detectSubdomainSlug();
  if (sub) {
    localStorage.setItem("conversastore_active_slug", sub);
    return sub;
  }
  const saved = localStorage.getItem("conversastore_active_slug");
  if (saved && !["defaut", "default", "awa-chic-tech", "awa-chic"].includes(saved)) {
    return saved;
  }
  return "faso-danfani";
};

export const setActiveStoreSlug = (slug) => {
  if (slug) {
    localStorage.setItem("conversastore_active_slug", slug);
    if (typeof window !== "undefined" && window.history && window.history.pushState) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("store", slug);
        window.history.pushState({}, "", url.toString());
      } catch (e) {}
    }
  } else {
    localStorage.removeItem("conversastore_active_slug");
  }
};

export const fetchWithStore = (url, options = {}) => {
  const slug = getActiveStoreSlug();
  const headers = new Headers(options.headers || {});
  if (slug && !headers.has("X-Store-Slug")) {
    headers.set("X-Store-Slug", slug);
  }
  return fetch(url, { ...options, headers });
};

export async function safeParseJson(res) {
  try {
    const text = await res.text();
    if (!text || !text.trim()) {
      return {};
    }
    return JSON.parse(text);
  } catch (e) {
    console.warn("safeParseJson: Non-JSON response received:", e);
    return { detail: `Réponse serveur inattendue (${res.status})` };
  }
}

export const getMediaUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${MEDIA_BASE}${path}`;
};

export async function fetchStore() {
  const slug = getActiveStoreSlug();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetchWithStore(`${API_BASE}/store`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.name) return data;
    }
  } catch (e) {
    console.warn("fetchStore fallback used for slug:", slug, e);
  }
  return getFallbackStore(slug);
}

export async function updateStore(storeId, data) {
  const res = await fetch(`${API_BASE}/store/${storeId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur lors de la mise à jour de la boutique");
  return res.json();
}

export async function fetchCategories() {
  const slug = getActiveStoreSlug();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetchWithStore(`${API_BASE}/catalog/categories`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {
    console.warn("fetchCategories fallback used for slug:", slug, e);
  }
  return getFallbackCategories(slug);
}

export async function fetchProducts(categoryId = null) {
  const slug = getActiveStoreSlug();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const url = categoryId
      ? `${API_BASE}/catalog/products?category_id=${categoryId}`
      : `${API_BASE}/catalog/products`;
    const res = await fetchWithStore(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {
    console.warn("fetchProducts fallback used for slug:", slug, e);
  }
  return getFallbackProducts(slug, categoryId);
}

export async function fetchHeroProduct() {
  const slug = getActiveStoreSlug();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetchWithStore(`${API_BASE}/catalog/products/hero`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.name) return data;
    }
  } catch (e) {
    console.warn("fetchHeroProduct fallback used:", e);
  }
  const products = getFallbackProducts(slug);
  return products.find((p) => p.is_hero_deal) || products[0] || null;
}

export async function createProduct(payload) {
  const res = await fetchWithStore(`${API_BASE}/catalog/products`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur de création de produit");
  }
  return res.json();
}

export async function updateProduct(productId, payload) {
  const res = await fetchWithStore(`${API_BASE}/catalog/products/${productId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur de mise à jour du produit");
  }
  return res.json();
}

export async function deleteProduct(productId, hard = false) {
  const url = hard ? `${API_BASE}/catalog/products/${productId}?hard=true` : `${API_BASE}/catalog/products/${productId}`;
  const res = await fetchWithStore(url, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erreur de suppression du produit");
  return res.json();
}

export async function trackVisit(source = "direct") {
  try {
    await fetchWithStore(`${API_BASE}/analytics/track-visit?source=${encodeURIComponent(source)}`, {
      method: "POST",
    });
  } catch (e) {
    console.error("Tracking error:", e);
  }
}

export async function fetchChannels() {
  const slug = getActiveStoreSlug();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetchWithStore(`${API_BASE}/channels`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {
    console.warn("fetchChannels fallback used:", e);
  }
  const st = getFallbackStore(slug);
  return st?.channels || [];
}

export async function updateChannel(channelId, data) {
  const res = await fetch(`${API_BASE}/channels/${channelId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur lors de la mise à jour du canal");
  return res.json();
}

export async function createOrderIntent(payload) {
  const res = await fetch(`${API_BASE}/intents`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur de création de commande");
  }
  return res.json();
}

export async function fetchPendingFollowups() {
  const res = await fetch(`${API_BASE}/intents/pending-followup`);
  if (!res.ok) throw new Error("Erreur de chargement des relances");
  return res.json();
}

export async function fetchIntentFeed(params = {}) {
  const query = new URLSearchParams();
  if (params.search) query.append("search", params.search);
  if (params.channel && params.channel !== "ALL") query.append("channel", params.channel);
  if (params.status && params.status !== "ALL") query.append("status", params.status);
  if (params.include_archived) query.append("include_archived", "true");
  if (params.limit) query.append("limit", params.limit);
  
  const queryString = query.toString() ? `?${query.toString()}` : "";
  const res = await fetch(`${API_BASE}/intents/feed${queryString}`);
  if (!res.ok) throw new Error("Erreur de chargement du flux d'intentions");
  return res.json();
}

export async function archiveIntent(intentId) {
  const res = await fetch(`${API_BASE}/intents/${intentId}/archive`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Erreur lors de l'archivage de l'intention");
  return res.json();
}

export async function deleteIntent(intentId) {
  const res = await fetch(`${API_BASE}/intents/${intentId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Erreur lors de la suppression de l'intention");
  return res.json();
}

export async function confirmSale(intentId, payload) {
  const res = await fetch(`${API_BASE}/intents/${intentId}/confirm`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Erreur de confirmation de vente");
  return res.json();
}

export async function confirmByToken(token, payload) {
  const res = await fetch(`${API_BASE}/intents/confirm-by-token/${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Erreur de confirmation par lien");
  return res.json();
}

export async function fetchAnalytics(period = "today") {
  const res = await fetch(`${API_BASE}/analytics/overview?period=${period}`);
  if (!res.ok) throw new Error("Erreur de chargement des statistiques");
  return res.json();
}

// Authentication & Security APIs
export function getAuthToken() {
  return localStorage.getItem("conversastore_auth_token");
}

export function setAuthToken(token) {
  if (token) {
    localStorage.setItem("conversastore_auth_token", token);
  } else {
    localStorage.removeItem("conversastore_auth_token");
  }
}

export function clearAuthToken() {
  localStorage.removeItem("conversastore_auth_token");
}

export async function resetOwnerCredentials() {
  const res = await fetch(`${API_BASE}/auth/reset-credentials`, {
    method: "POST",
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Erreur de réinitialisation");
  }
  return data;
}

export async function loginOwner(identifier, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Identifiants incorrects");
  }
  setAuthToken(data.access_token);
  return data;
}

export async function changePassword(currentPassword, newPassword, confirmPassword) {
  const token = getAuthToken();
  const res = await fetch(`${API_BASE}/auth/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Erreur de changement de mot de passe");
  }
  if (data.access_token) {
    setAuthToken(data.access_token);
  }
  return data;
}

export async function validatePasswordOnline(password) {
  const res = await fetch(`${API_BASE}/auth/validate-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (!res.ok) return { is_valid: false, errors: [], checks: [] };
  return res.json();
}

export async function fetchAuthStatus() {
  const token = getAuthToken();
  if (!token) {
    return { is_authenticated: false, must_change_password: true, owner_name: null };
  }
  try {
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      clearAuthToken();
      return { is_authenticated: false, must_change_password: true, owner_name: null };
    }
    return res.json();
  } catch (e) {
    return { is_authenticated: false, must_change_password: true, owner_name: null };
  }
}

export async function logoutOwner() {
  const token = getAuthToken();
  if (token) {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  clearAuthToken();
}

// ----------------------------------------------------------------------------
// Customer Portal API (Client Space)
// ----------------------------------------------------------------------------
const CUSTOMER_TOKEN_KEY = "conversastore_customer_token";

export const getCustomerToken = () => localStorage.getItem(CUSTOMER_TOKEN_KEY);
export const setCustomerToken = (t) => localStorage.setItem(CUSTOMER_TOKEN_KEY, t);
export const clearCustomerToken = () => localStorage.removeItem(CUSTOMER_TOKEN_KEY);

export async function customerQuickRegister(payload) {
  try {
    const res = await fetch(`${API_BASE}/customer/quick-register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await safeParseJson(res);
    if (!res.ok) {
      throw new Error(data.detail || `Erreur d'inscription client (${res.status})`);
    }
    if (data.access_token) {
      setCustomerToken(data.access_token);
    }
    if (data.customer) {
      localStorage.setItem("gatoshop_local_customer", JSON.stringify(data.customer));
    }
    return data;
  } catch (err) {
    // If backend is offline or 404 on Vercel, activate seamless local guest customer mode
    console.warn("API unavailable or failed, fallback to local registration:", err.message);
    const localCust = {
      id: "cust-local-" + Date.now(),
      name: payload.name || "Client Invité",
      phone: payload.phone,
      city: payload.city || "Abidjan",
      delivery_address: payload.city || "Abidjan",
      bonus_points: 10,
      session_token: "token_local_" + Date.now(),
    };
    const localToken = localCust.session_token;
    setCustomerToken(localToken);
    localStorage.setItem("gatoshop_local_customer", JSON.stringify(localCust));
    return {
      success: true,
      access_token: localToken,
      customer: localCust,
      is_local: true,
    };
  }
}

export async function customerQuickLogin(payload) {
  try {
    const res = await fetch(`${API_BASE}/customer/quick-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await safeParseJson(res);
    if (!res.ok) {
      throw new Error(data.detail || `Numéro non reconnu (${res.status})`);
    }
    if (data.access_token) {
      setCustomerToken(data.access_token);
    }
    if (data.customer) {
      localStorage.setItem("gatoshop_local_customer", JSON.stringify(data.customer));
    }
    return data;
  } catch (err) {
    // Fallback: Check local saved profile
    const rawCust = localStorage.getItem("gatoshop_local_customer");
    if (rawCust) {
      try {
        const parsed = JSON.parse(rawCust);
        const cleanInput = (payload.phone || "").replace(/\D/g, "");
        const cleanSaved = (parsed.phone || "").replace(/\D/g, "");
        if (cleanSaved && cleanInput && (cleanSaved.includes(cleanInput) || cleanInput.includes(cleanSaved))) {
          const token = parsed.session_token || "token_local_cust";
          setCustomerToken(token);
          return { success: true, access_token: token, customer: parsed, is_local: true };
        }
      } catch {}
    }
    // Fallback: Check local orders
    const localOrders = getLocalGuestOrders();
    const cleanInput = (payload.phone || "").replace(/\D/g, "");
    const matching = localOrders.find((o) => (o.customer_phone || "").replace(/\D/g, "").includes(cleanInput));
    if (matching && cleanInput.length >= 6) {
      const localCust = {
        id: "cust-local-" + Date.now(),
        name: matching.customer_name || "Client Fidèle",
        phone: payload.phone,
        city: matching.delivery_city || "Abidjan",
        session_token: "token_local_order",
      };
      setCustomerToken(localCust.session_token);
      localStorage.setItem("gatoshop_local_customer", JSON.stringify(localCust));
      return { success: true, access_token: localCust.session_token, customer: localCust, is_local: true };
    }
    throw new Error(err.message.includes("Numéro non") ? err.message : "Numéro introuvable. Veuillez utiliser l'onglet 'Nouveau Client' pour vous inscrire en 3s.");
  }
}

export async function fetchCustomerProfile() {
  const token = getCustomerToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API_BASE}/customer/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const raw = localStorage.getItem("gatoshop_local_customer");
      return raw ? JSON.parse(raw) : null;
    }
    const data = await safeParseJson(res);
    if (data && data.id) {
      localStorage.setItem("gatoshop_local_customer", JSON.stringify(data));
      return data;
    }
    const raw = localStorage.getItem("gatoshop_local_customer");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    const raw = localStorage.getItem("gatoshop_local_customer");
    return raw ? JSON.parse(raw) : null;
  }
}

export async function updateCustomerProfile(payload) {
  const token = getCustomerToken();
  if (!token) throw new Error("Non connecté");
  const res = await fetch(`${API_BASE}/customer/profile`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Erreur lors de la mise à jour du profil");
  }
  return data;
}

export async function fetchCustomerOrders() {
  const token = getCustomerToken();
  if (!token) return [];
  const res = await fetch(`${API_BASE}/customer/orders`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return [];
  return res.json();
}

export async function fetchCustomerStats() {
  const token = getCustomerToken();
  if (!token) return null;
  const res = await fetch(`${API_BASE}/customer/stats`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

// ----------------------------------------------------------------------------
// Merchant Loyalty Program Management API
// ----------------------------------------------------------------------------
export async function fetchLoyaltyTiers(storeId) {
  const res = await fetch(`${API_BASE}/store/${storeId}/loyalty-tiers`);
  if (!res.ok) return [];
  return res.json();
}

export async function createLoyaltyTier(storeId, payload) {
  const res = await fetch(`${API_BASE}/store/${storeId}/loyalty-tiers`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur de création de palier");
  }
  return res.json();
}

export async function updateLoyaltyTier(storeId, tierId, payload) {
  const res = await fetch(`${API_BASE}/store/${storeId}/loyalty-tiers/${tierId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur de mise à jour du palier");
  }
  return res.json();
}

export async function deleteLoyaltyTier(storeId, tierId) {
  const res = await fetch(`${API_BASE}/store/${storeId}/loyalty-tiers/${tierId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur de suppression du palier");
  }
  return res.json();
}

// ----------------------------------------------------------------------------
// Client Satisfaction & Cancellation Actions (Guest or Logged In)
// ----------------------------------------------------------------------------
export async function recordClientOrderAction(intentIdOrRef, action, reason = null, rating = 5) {
  const res = await fetch(`${API_BASE}/intents/${intentIdOrRef}/client-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, reason, rating }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur lors de l'enregistrement de l'action");
  }
  return res.json();
}

export async function resolveDiscrepancy(intentId, resolution, notes = null) {
  const res = await fetch(`${API_BASE}/intents/${intentId}/resolve-discrepancy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ resolution, notes }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur lors de la résolution du litige");
  }
  return res.json();
}

export async function fetchOrderByReference(referenceCode) {
  const res = await fetch(`${API_BASE}/intents/by-reference/${encodeURIComponent(referenceCode)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Commande introuvable");
  }
  return res.json();
}

export async function fetchBatchOrders(intentIds) {
  if (!intentIds || intentIds.length === 0) return [];
  const res = await fetch(`${API_BASE}/intents/batch-lookup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ intent_ids: intentIds }),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function linkGuestOrdersToAccount(orderIds) {
  const token = getCustomerToken();
  if (!token || !orderIds || orderIds.length === 0) return 0;
  const res = await fetch(`${API_BASE}/customer/link-guest-orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ order_ids: orderIds }),
  });
  if (!res.ok) return 0;
  const data = await res.json();
  return data.linked_count || 0;
}

export async function fetchDiscrepancies() {
  const res = await fetch(`${API_BASE}/intents/discrepancies`);
  if (!res.ok) return [];
  return res.json();
}

// ----------------------------------------------------------------------------
// Merchant Notifications & Real-Time Alerts
// ----------------------------------------------------------------------------
export async function fetchNotifications() {
  const res = await fetch(`${API_BASE}/notifications`);
  if (!res.ok) return { unread_count: 0, discrepancies_count: 0, notifications: [] };
  return res.json();
}

export async function markNotificationRead(id) {
  const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
    method: "POST",
  });
  return res.ok;
}

export async function markAllNotificationsRead() {
  const res = await fetch(`${API_BASE}/notifications/read-all`, {
    method: "POST",
  });
  return res.ok;
}

// ----------------------------------------------------------------------------
// Guest Orders LocalStorage Management
// ----------------------------------------------------------------------------
const GUEST_ORDERS_KEY = "gatoshop_guest_orders";

export function getLocalGuestOrders() {
  try {
    const raw = localStorage.getItem(GUEST_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalGuestOrder(order) {
  try {
    const existing = getLocalGuestOrders();
    const updated = [order, ...existing.filter((o) => o.id !== order.id && o.reference_code !== order.reference_code)];
    localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(updated.slice(0, 20)));
  } catch (e) {
    console.warn("Could not persist guest order to localStorage:", e);
  }
}

export function updateLocalGuestOrder(orderId, patch) {
  try {
    const existing = getLocalGuestOrders();
    const updated = existing.map((o) => (o.id === orderId ? { ...o, ...patch } : o));
    localStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Could not update guest order in localStorage:", e);
  }
}

export function clearLocalGuestOrders() {
  try {
    localStorage.removeItem(GUEST_ORDERS_KEY);
  } catch {}
}

// ----------------------------------------------------------------------------
// Merchant CRM / Customer Management
// ----------------------------------------------------------------------------
export async function fetchMerchantClients(search = "") {
  const query = search ? `?search=${encodeURIComponent(search)}` : "";
  const res = await fetch(`${API_BASE}/customer/merchant/clients${query}`);
  if (!res.ok) throw new Error("Erreur de chargement des clients");
  return res.json();
}

export async function fetchMerchantClientDetail(customerId) {
  const res = await fetch(`${API_BASE}/customer/merchant/clients/${customerId}`);
  if (!res.ok) throw new Error("Erreur de chargement de la fiche client");
  return res.json();
}

export async function moderateMerchantClient(customerId, data) {
  const res = await fetch(`${API_BASE}/customer/merchant/clients/${customerId}/moderate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur lors de la modération du client");
  return res.json();
}

export async function grantMerchantClientPerk(customerId, data) {
  const res = await fetch(`${API_BASE}/customer/merchant/clients/${customerId}/grant-perk`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur lors de l'attribution de l'avantage");
  return res.json();
}

// ----------------------------------------------------------------------------
// Super-Admin & Platform Multi-Store API
// ----------------------------------------------------------------------------
export const SUPER_ADMIN_TOKEN_KEY = "conversastore_super_admin_token";

export function getSuperAdminToken() {
  return localStorage.getItem(SUPER_ADMIN_TOKEN_KEY);
}

export function setSuperAdminToken(token) {
  if (token) localStorage.setItem(SUPER_ADMIN_TOKEN_KEY, token);
  else localStorage.removeItem(SUPER_ADMIN_TOKEN_KEY);
}

export async function loginSuperAdmin(email, password) {
  const res = await fetch(`${API_BASE}/super-admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Identifiants Super-Admin incorrects");
  }
  const data = await res.json();
  if (data.session_token) {
    setSuperAdminToken(data.session_token);
  }
  return data;
}

export async function fetchSuperAdminMe() {
  const token = getSuperAdminToken();
  if (!token) return { is_authenticated: false };
  const res = await fetch(`${API_BASE}/super-admin/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    setSuperAdminToken(null);
    return { is_authenticated: false };
  }
  return res.json();
}

export async function logoutSuperAdmin() {
  const token = getSuperAdminToken();
  if (token) {
    await fetch(`${API_BASE}/super-admin/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {});
  }
  setSuperAdminToken(null);
}

export async function fetchSuperAdminOverview() {
  const token = getSuperAdminToken();
  const res = await fetch(`${API_BASE}/super-admin/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erreur chargement aperçu plateforme");
  return res.json();
}

export async function fetchSuperAdminStores() {
  const token = getSuperAdminToken();
  const res = await fetch(`${API_BASE}/super-admin/stores`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erreur chargement des boutiques");
  return res.json();
}

export async function createSuperAdminStore(payload) {
  const token = getSuperAdminToken();
  const res = await fetch(`${API_BASE}/super-admin/stores`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur lors de la création de la boutique");
  }
  return res.json();
}

export async function updateSuperAdminStoreStatus(storeId, payload) {
  const token = getSuperAdminToken();
  const res = await fetch(`${API_BASE}/super-admin/stores/${storeId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur mise à jour statut boutique");
  }
  return res.json();
}

export async function impersonateStoreOwner(storeId) {
  const token = getSuperAdminToken();
  const res = await fetch(`${API_BASE}/super-admin/stores/${storeId}/impersonate`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erreur d'accès direct à la boutique");
  return res.json();
}

export async function deleteSuperAdminStore(storeId) {
  const token = getSuperAdminToken();
  const res = await fetch(`${API_BASE}/super-admin/stores/${storeId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Impossible de supprimer la boutique");
  }
  return res.json();
}

export async function fetchPublicStores() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${API_BASE}/store/list/public`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) return data;
    }
  } catch (e) {
    console.warn("fetchPublicStores fallback used:", e);
  }
  return FALLBACK_PUBLIC_STORES;
}

// ==========================================
// SUBSCRIPTION & USSD API
// ==========================================

export async function fetchSubscriptionPublicInfo() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${API_BASE}/subscription/public-info`, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await res.json();
      if (data && data.plans && data.plans.length > 0) {
        return data;
      }
    }
  } catch (e) {
    console.warn("fetchSubscriptionPublicInfo fallback used:", e);
  }
  return FALLBACK_SUBSCRIPTION_PUBLIC_INFO;
}

export async function submitSubscriptionRequest(payload) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(`${API_BASE}/subscription/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
    const err = await res.json().catch(() => ({}));
    if (err.detail) throw new Error(err.detail);
  } catch (e) {
    console.warn("submitSubscriptionRequest server error, saving locally:", e);
  }

  // Resilient fallback: persist subscription request locally
  const refCode = "SUB-" + Math.floor(100000 + Math.random() * 900000);
  const localSubmission = {
    id: "sub-req-" + Date.now(),
    reference_code: refCode,
    status: "PENDING",
    store_name: payload.store_name,
    owner_name: payload.owner_name,
    owner_phone: payload.owner_phone,
    owner_email: payload.owner_email,
    plan_code: payload.plan_code,
    operator_code: payload.operator_code,
    notes: payload.notes,
    created_at: new Date().toISOString(),
  };

  try {
    const existing = JSON.parse(localStorage.getItem("gotoshop_local_subscription_submissions") || "[]");
    localStorage.setItem("gotoshop_local_subscription_submissions", JSON.stringify([localSubmission, ...existing]));
  } catch (err) {}

  return localSubmission;
}

export async function fetchStoreSubscriptionStatus(storeId) {
  const res = await fetch(`${API_BASE}/subscription/store/${storeId}/status`);
  if (!res.ok) throw new Error("Impossible de récupérer le statut de l'abonnement");
  return res.json();
}

export async function fetchSuperAdminSubRequests(status = "ALL") {
  const token = getSuperAdminToken();
  const res = await fetch(`${API_BASE}/subscription/requests?status=${encodeURIComponent(status)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erreur de chargement des demandes d'abonnement");
  return res.json();
}

export async function reviewSuperAdminSubRequest(reqId, payload) {
  const token = getSuperAdminToken();
  const res = await fetch(`${API_BASE}/subscription/requests/${reqId}/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur lors de la validation de la demande");
  }
  return res.json();
}

export async function fetchSuperAdminPlans() {
  const token = getSuperAdminToken();
  const res = await fetch(`${API_BASE}/subscription/plans`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erreur de chargement des forfaits");
  return res.json();
}

export async function updateSuperAdminPlan(planId, payload) {
  const token = getSuperAdminToken();
  const res = await fetch(`${API_BASE}/subscription/plans/${planId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur mise à jour du forfait");
  }
  return res.json();
}

export async function fetchSuperAdminUssdConfigs() {
  const token = getSuperAdminToken();
  const res = await fetch(`${API_BASE}/subscription/ussd-configs`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Erreur de chargement des configurations USSD");
  return res.json();
}

export async function updateSuperAdminUssdConfig(configId, payload) {
  const token = getSuperAdminToken();
  const res = await fetch(`${API_BASE}/subscription/ussd-configs/${configId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur mise à jour configuration USSD");
  }
  return res.json();
}




