import safeStorage from "../utils/safeStorage";
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
  if (storeParam && storeParam.trim()) {
    const clean = storeParam.trim();
    safeStorage.setItem("conversastore_active_slug", clean);
    return clean;
  }
  const pathname = window.location.pathname;
  const storePathMatch = pathname.match(/^\/(?:store|boutique|s)\/([a-zA-Z0-9_-]+)/);
  if (storePathMatch && storePathMatch[1]) {
    const clean = storePathMatch[1].trim();
    safeStorage.setItem("conversastore_active_slug", clean);
    return clean;
  }
  const sub = detectSubdomainSlug();
  if (sub) {
    safeStorage.setItem("conversastore_active_slug", sub);
    return sub;
  }
  const saved = safeStorage.getItem("conversastore_active_slug");
  if (saved && saved.trim() && !["defaut", "default", "null", "undefined"].includes(saved.trim().toLowerCase())) {
    return saved.trim();
  }
  return "faso-danfani";
};

export const setActiveStoreSlug = (slug) => {
  if (slug && slug.trim()) {
    const clean = slug.trim();
    safeStorage.setItem("conversastore_active_slug", clean);
    if (typeof window !== "undefined" && window.history && window.history.pushState) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("store", clean);
        window.history.pushState({}, "", url.toString());
      } catch (e) {}
    }
  } else {
    safeStorage.removeItem("conversastore_active_slug");
  }
};

export const fetchWithStore = (url, options = {}, explicitSlug = null) => {
  const slug = explicitSlug || getActiveStoreSlug();
  const headers = new Headers(options.headers || {});
  if (slug && !headers.has("X-Store-Slug")) {
    headers.set("X-Store-Slug", slug);
  }
  let targetUrl = url;
  if (slug) {
    const separator = targetUrl.includes("?") ? "&" : "?";
    if (!targetUrl.includes("store=") && !targetUrl.includes("slug=")) {
      targetUrl = `${targetUrl}${separator}store=${encodeURIComponent(slug)}`;
    }
  }
  return fetch(targetUrl, { ...options, headers });
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

export function formatErrorMessage(data, defaultMsg = "Une erreur est survenue") {
  if (!data) return defaultMsg;
  if (typeof data === "string") return data;
  if (typeof data.detail === "string") return data.detail;
  if (Array.isArray(data.detail)) {
    return data.detail
      .map((d) => {
        const field = d.loc ? d.loc[d.loc.length - 1] : "";
        return field ? `${field}: ${d.msg}` : d.msg;
      })
      .join(", ");
  }
  if (data.message && typeof data.message === "string") return data.message;
  return defaultMsg;
}

export const getMediaUrl = (path) => {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${MEDIA_BASE}${path}`;
};

export async function fetchStore(explicitSlug = null) {
  const slug = explicitSlug || getActiveStoreSlug();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetchWithStore(`${API_BASE}/store`, { signal: controller.signal }, slug);
    clearTimeout(timeoutId);
    if (res.ok) {
      const data = await safeParseJson(res);
      // Strictly verify that the returned store matches the requested slug
      if (data && data.name && (!slug || data.slug?.toLowerCase() === slug.toLowerCase())) {
        return data;
      }
    }
  } catch (e) {
    console.warn("fetchStore fallback used for slug:", slug, e);
  }
  return getFallbackStore(slug);
}

export async function updateStore(storeId, data) {
  const token = getAuthToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}/store/${storeId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(data),
  });
  const resData = await safeParseJson(res);
  if (!res.ok) throw new Error(formatErrorMessage(resData, "Erreur lors de la mise à jour de la boutique"));
  return resData;
}

export async function fetchStoreReviews(storeId) {
  try {
    const res = await fetch(`${API_BASE}/store/${storeId}/reviews`);
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn("fetchStoreReviews fallback used:", e);
  }
  return [];
}

export async function registerMerchantStore(payload) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000);
    const res = await fetch(`${API_BASE}/store/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const data = await safeParseJson(res);
    if (res.ok) {
      if (data.access_token) {
        setAuthToken(data.access_token);
      }
      if (data.slug) {
        setActiveStoreSlug(data.slug);
        safeStorage.setItem("conversastore_owner_store_slug", data.slug);
      }
      if (data.store_id) {
        safeStorage.setItem("conversastore_owner_store_id", data.store_id);
      }
      if (data.owned_stores) {
        safeStorage.setItem("conversastore_owned_stores", JSON.stringify(data.owned_stores));
      }
      return data;
    }
    // If validation error from backend (like missing required fields), throw
    if (res.status === 400 || res.status === 422) {
      throw new Error(formatErrorMessage(data, "Erreur lors de la création de la boutique"));
    }
  } catch (e) {
    if (e.message && !e.message.includes("fetch") && !e.message.includes("abort") && !e.message.includes("500")) {
      throw e;
    }
    console.warn("registerMerchantStore server unavailable, applying resilient local creation:", e);
  }

  // Resilient fallback if backend is offline or encountered temporary issue
  const slug =
    payload.store_name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `boutique-${Date.now().toString(36)}`;

  const token = "local_tok_" + Math.random().toString(36).substring(2);
  setAuthToken(token);
  setActiveStoreSlug(slug);

  const isPaid = Boolean(payload.plan_code && payload.plan_code !== "TRIAL");

  return {
    success: true,
    message: "Félicitations ! Votre boutique a été créée et activée avec succès.",
    store_id: "store-" + Date.now(),
    store_name: payload.store_name,
    slug,
    store_url: `?store=${slug}`,
    access_token: token,
    owner: {
      id: "owner-" + Date.now(),
      full_name: payload.owner_name,
      email: payload.owner_email || `${slug}@gotoshop.bf`,
      phone_number: payload.owner_phone,
    },
    temporary_password: payload.password || "GotoShop!2026",
    subscription_status: isPaid ? "ACTIVE" : "TRIAL",
    subscription_plan: payload.plan_code || "STARTER",
    trial_days: isPaid ? 30 : 14,
  };
}

export async function fetchCategories(explicitSlug = null) {
  const slug = explicitSlug || getActiveStoreSlug();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetchWithStore(`${API_BASE}/catalog/categories`, { signal: controller.signal }, slug);
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

export async function fetchProducts(categoryId = null, explicitSlug = null) {
  const slug = explicitSlug || getActiveStoreSlug();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const url = categoryId
      ? `${API_BASE}/catalog/products?category_id=${categoryId}`
      : `${API_BASE}/catalog/products`;
    const res = await fetchWithStore(url, { signal: controller.signal }, slug);
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

export async function fetchHeroProduct(explicitSlug = null) {
  const slug = explicitSlug || getActiveStoreSlug();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetchWithStore(`${API_BASE}/catalog/products/hero`, { signal: controller.signal }, slug);
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
  const token = getAuthToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetchWithStore(`${API_BASE}/catalog/products`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await safeParseJson(res);
  if (!res.ok) {
    throw new Error(formatErrorMessage(data, "Erreur de création de produit"));
  }
  return data;
}

export async function updateProduct(productId, payload) {
  const token = getAuthToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetchWithStore(`${API_BASE}/catalog/products/${productId}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(payload),
  });
  const data = await safeParseJson(res);
  if (!res.ok) {
    throw new Error(formatErrorMessage(data, "Erreur de mise à jour du produit"));
  }
  return data;
}

export async function deleteProduct(productId, hard = false) {
  const token = getAuthToken();
  const headers = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const url = hard ? `${API_BASE}/catalog/products/${productId}?hard=true` : `${API_BASE}/catalog/products/${productId}`;
  const res = await fetchWithStore(url, {
    method: "DELETE",
    headers,
  });
  const data = await safeParseJson(res);
  if (!res.ok) throw new Error(formatErrorMessage(data, "Erreur de suppression du produit"));
  return data;
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

export async function fetchChannels(explicitSlug = null) {
  const slug = explicitSlug || getActiveStoreSlug();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetchWithStore(`${API_BASE}/channels`, { signal: controller.signal }, slug);
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
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(`${API_BASE}/intents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn("createOrderIntent server error, using resilient fallback:", err);
  }

  // Resilient fallback: generate intent locally
  const ref = "CMD-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  const id = "intent-" + Date.now();
  const msg = payload.custom_message || `Bonjour, je confirme ma commande #${ref}`;
  const redirect_url = `https://wa.me/22670123456?text=${encodeURIComponent(msg)}`;

  return {
    id,
    reference_code: ref,
    store_id: payload.store_id,
    product_id: payload.product_id,
    channel_type: payload.channel_type || "WHATSAPP",
    quantity: payload.quantity || 1,
    selected_color: payload.selected_color,
    delivery_city: payload.delivery_city,
    status: "CREATED",
    client_status: "PENDING",
    redirect_url,
    total_amount: (payload.quantity || 1) * 1000,
    created_at: new Date().toISOString(),
  };
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
  return safeStorage.getItem("conversastore_auth_token");
}

export function setAuthToken(token) {
  if (token) {
    safeStorage.setItem("conversastore_auth_token", token);
  } else {
    safeStorage.removeItem("conversastore_auth_token");
  }
}

export function clearAuthToken() {
  safeStorage.removeItem("conversastore_auth_token");
  safeStorage.removeItem("conversastore_owner_store_slug");
  safeStorage.removeItem("conversastore_owner_store_id");
  safeStorage.removeItem("conversastore_owned_stores");
}

export async function resetOwnerCredentials() {
  const res = await fetch(`${API_BASE}/auth/reset-credentials`, {
    method: "POST",
  });
  const data = await safeParseJson(res);
  if (!res.ok) {
    throw new Error(formatErrorMessage(data, "Erreur de réinitialisation"));
  }
  return data;
}

export async function loginOwner(identifier, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier, password }),
  });
  const data = await safeParseJson(res);
  if (!res.ok) {
    throw new Error(formatErrorMessage(data, "Identifiants incorrects ou compte verrouillé"));
  }
  if (data.access_token) {
    setAuthToken(data.access_token);
    if (data.store_slugs && data.store_slugs.length > 0) {
      safeStorage.setItem("conversastore_owner_store_slug", data.store_slugs[0]);
    }
    if (data.store_ids && data.store_ids.length > 0) {
      safeStorage.setItem("conversastore_owner_store_id", data.store_ids[0]);
    }
    if (data.owned_stores) {
      safeStorage.setItem("conversastore_owned_stores", JSON.stringify(data.owned_stores));
    }
  }
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
  const data = await safeParseJson(res);
  if (!res.ok) {
    throw new Error(formatErrorMessage(data, "Erreur de changement de mot de passe"));
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
  return await safeParseJson(res);
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
    return await safeParseJson(res);
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

export const getCustomerToken = () => safeStorage.getItem(CUSTOMER_TOKEN_KEY);
export const setCustomerToken = (t) => safeStorage.setItem(CUSTOMER_TOKEN_KEY, t);
export const clearCustomerToken = () => safeStorage.removeItem(CUSTOMER_TOKEN_KEY);

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
      safeStorage.setItem("gatoshop_local_customer", JSON.stringify(data.customer));
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
    safeStorage.setItem("gatoshop_local_customer", JSON.stringify(localCust));
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
      safeStorage.setItem("gatoshop_local_customer", JSON.stringify(data.customer));
    }
    return data;
  } catch (err) {
    // Fallback: Check local saved profile
    const rawCust = safeStorage.getItem("gatoshop_local_customer");
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
      safeStorage.setItem("gatoshop_local_customer", JSON.stringify(localCust));
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
      const raw = safeStorage.getItem("gatoshop_local_customer");
      return raw ? JSON.parse(raw) : null;
    }
    const data = await safeParseJson(res);
    if (data && data.id) {
      safeStorage.setItem("gatoshop_local_customer", JSON.stringify(data));
      return data;
    }
    const raw = safeStorage.getItem("gatoshop_local_customer");
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    const raw = safeStorage.getItem("gatoshop_local_customer");
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
// Guest Orders LocalStorage Management
// ----------------------------------------------------------------------------
const GUEST_ORDERS_KEY = "gatoshop_guest_orders";

export function getLocalGuestOrders() {
  try {
    const raw = safeStorage.getItem(GUEST_ORDERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveLocalGuestOrder(order) {
  try {
    const existing = getLocalGuestOrders();
    const updated = [order, ...existing.filter((o) => o.id !== order.id && o.reference_code !== order.reference_code)];
    safeStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(updated.slice(0, 20)));
  } catch (e) {
    console.warn("Could not persist guest order to localStorage:", e);
  }
}

export function updateLocalGuestOrder(orderId, patch) {
  try {
    const existing = getLocalGuestOrders();
    const updated = existing.map((o) => (o.id === orderId ? { ...o, ...patch } : o));
    safeStorage.setItem(GUEST_ORDERS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn("Could not update guest order in localStorage:", e);
  }
}

export function clearLocalGuestOrders() {
  try {
    safeStorage.removeItem(GUEST_ORDERS_KEY);
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
  return safeStorage.getItem(SUPER_ADMIN_TOKEN_KEY);
}

export function setSuperAdminToken(token) {
  if (token) safeStorage.setItem(SUPER_ADMIN_TOKEN_KEY, token);
  else safeStorage.removeItem(SUPER_ADMIN_TOKEN_KEY);
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

export async function verifySuperAdminStore(storeId, isVerified = true) {
  const token = getSuperAdminToken();
  const res = await fetch(`${API_BASE}/super-admin/stores/${storeId}/verify`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ is_verified: isVerified }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur de validation de la boutique");
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
    const existing = JSON.parse(safeStorage.getItem("gotoshop_local_subscription_submissions") || "[]");
    safeStorage.setItem("gotoshop_local_subscription_submissions", JSON.stringify([localSubmission, ...existing]));
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

// ============================================================================
// CONVERSATIONAL COMMERCE & REAL-TIME CHAT API
// ============================================================================

export function getChatWebSocketUrl(conversationId, params = {}) {
  let wsBase = API_BASE.replace(/^http/, "ws");
  const query = new URLSearchParams(params).toString();
  return `${wsBase}/ws/chat/${conversationId}${query ? "?" + query : ""}`;
}

export async function fetchConversations({ store_id, customer_id, customer_token, context_filter, search } = {}) {
  const query = new URLSearchParams();
  if (store_id) query.set("store_id", store_id);
  if (customer_id) query.set("customer_id", customer_id);
  if (customer_token) query.set("customer_token", customer_token);
  if (context_filter) query.set("context_filter", context_filter);
  if (search) query.set("search", search);

  const res = await fetch(`${API_BASE}/conversations?${query.toString()}`);
  if (!res.ok) return [];
  return res.json();
}

export async function createOrGetConversation(payload) {
  const res = await fetch(`${API_BASE}/conversations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur ouverture conversation");
  }
  return res.json();
}

export async function fetchConversationDetail(conversationId) {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}`);
  if (!res.ok) throw new Error("Conversation introuvable");
  return res.json();
}

export async function fetchConversationMessages(conversationId, limit = 100, offset = 0) {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}`);
  if (!res.ok) return [];
  return res.json();
}

export async function sendChatMessage(conversationId, messageData) {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messageData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur lors de l'envoi du message");
  }
  return res.json();
}

export async function uploadChatMedia(conversationId, formData) {
  const res = await fetch(`${API_BASE}/conversations/${conversationId}/media`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur lors du téléversement du média");
  }
  return res.json();
}

export async function markConversationRead(conversationId, userType = "CUSTOMER", userId = null) {
  try {
    await fetch(`${API_BASE}/conversations/${conversationId}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_type: userType, user_id: userId }),
    });
  } catch (e) {}
}

// ============================================================================
// CONVERSATIONAL ORDERS & PAYMENT PROOFS
// ============================================================================

export async function createConversationalOrder(orderData) {
  const res = await fetch(`${API_BASE}/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(orderData),
  });
  const data = await safeParseJson(res);
  if (!res.ok) {
    throw new Error(formatErrorMessage(data, "Erreur lors de la création de la commande"));
  }
  return data;
}

export async function fetchConversationalOrders({ store_id, customer_id, customer_token, status } = {}) {
  const query = new URLSearchParams();
  if (store_id) query.set("store_id", store_id);
  if (customer_id) query.set("customer_id", customer_id);
  if (customer_token) query.set("customer_token", customer_token);
  if (status) query.set("status", status);

  const res = await fetch(`${API_BASE}/orders?${query.toString()}`);
  if (!res.ok) return [];
  return res.json();
}

export async function fetchOrderDetail(orderId) {
  const res = await fetch(`${API_BASE}/orders/${orderId}`);
  if (!res.ok) throw new Error("Commande introuvable");
  return res.json();
}

export async function acceptOrder(orderId, sellerName = "Commerçant") {
  const res = await fetch(`${API_BASE}/orders/${orderId}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seller_name: sellerName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur acceptation commande");
  }
  return res.json();
}

export async function rejectOrder(orderId, reason = "Indisponible", sellerName = "Commerçant") {
  const res = await fetch(`${API_BASE}/orders/${orderId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, seller_name: sellerName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur refus commande");
  }
  return res.json();
}

export async function cancelConversationalOrder(orderId, reason = "Annulé par le client", actorName = "Client") {
  const res = await fetch(`${API_BASE}/orders/${orderId}/cancel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, actor_name: actorName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur lors de l'annulation de la commande");
  }
  return res.json();
}

export async function submitPaymentProof(orderId, proofData) {
  const res = await fetch(`${API_BASE}/orders/${orderId}/payment-proof`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(proofData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur soumission de la preuve");
  }
  return res.json();
}

export async function uploadPaymentProof(orderId, formData) {
  const res = await fetch(`${API_BASE}/orders/${orderId}/payment-proof-upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur upload preuve de paiement");
  }
  return res.json();
}

export async function confirmOrderPayment(orderId, verifiedBy = "Commerçant", verificationNote = null) {
  const res = await fetch(`${API_BASE}/orders/${orderId}/confirm-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ verified_by: verifiedBy, verification_note: verificationNote }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur confirmation paiement");
  }
  return res.json();
}

export async function rejectOrderPayment(orderId, reason = "Montant incorrect", verifiedBy = "Commerçant") {
  const res = await fetch(`${API_BASE}/orders/${orderId}/reject-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason, verified_by: verifiedBy }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur rejet paiement");
  }
  return res.json();
}

export async function updateOrderStatus(orderId, status, notes = null, actorName = "Commerçant") {
  const res = await fetch(`${API_BASE}/orders/${orderId}/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status, notes, actor_name: actorName }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur mise à jour statut");
  }
  return res.json();
}

// ============================================================================
// NATIVE WEBRTC CALLS API
// ============================================================================

export async function startCallSession({ conversation_id, caller_type = "CUSTOMER", caller_name, call_type = "AUDIO", caller_id = null }) {
  const res = await fetch(`${API_BASE}/calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversation_id, caller_type, caller_name, call_type, caller_id }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur démarrage appel");
  }
  return res.json();
}

export async function answerCallSession(callId) {
  const res = await fetch(`${API_BASE}/calls/${callId}/answer`, { method: "POST" });
  if (!res.ok) throw new Error("Erreur acceptation appel");
  return res.json();
}

export async function rejectCallSession(callId, reason = "DECLINED") {
  const res = await fetch(`${API_BASE}/calls/${callId}/reject`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error("Erreur refus appel");
  return res.json();
}

export async function endCallSession(callId) {
  const res = await fetch(`${API_BASE}/calls/${callId}/end`, { method: "POST" });
  if (!res.ok) throw new Error("Erreur fin d'appel");
  return res.json();
}

export async function fetchCallHistory({ conversation_id, store_id, limit = 50 } = {}) {
  const query = new URLSearchParams();
  if (conversation_id) query.set("conversation_id", conversation_id);
  if (store_id) query.set("store_id", store_id);
  query.set("limit", limit);

  const res = await fetch(`${API_BASE}/calls/history?${query.toString()}`);
  if (!res.ok) return [];
  return res.json();
}

// ============================================================================
// CENTRALIZED NOTIFICATIONS & DECISION SUPPORT API
// ============================================================================

export async function fetchNotifications(options = {}) {
  try {
    const {
      recipient_type = null,
      recipient_id = null,
      store_id = null,
      category = null,
      limit = 50,
    } = typeof options === "object" && options !== null ? options : {};

    const query = new URLSearchParams();
    if (recipient_type) query.set("recipient_type", recipient_type);
    if (recipient_id) query.set("recipient_id", recipient_id);
    if (store_id) query.set("store_id", store_id);
    if (category) query.set("category", category);
    query.set("limit", limit);

    const res = await fetch(`${API_BASE}/notifications?${query.toString()}`);
    if (!res.ok) return { unread_count: 0, discrepancies_count: 0, notifications: [] };
    const data = await res.json();
    return {
      unread_count: data.unread_count || 0,
      discrepancies_count: data.discrepancies_count || 0,
      notifications: data.notifications || [],
    };
  } catch (e) {
    return { unread_count: 0, discrepancies_count: 0, notifications: [] };
  }
}

export async function markNotificationRead(notificationId) {
  try {
    const res = await fetch(`${API_BASE}/notifications/${notificationId}/read`, { method: "POST" });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function markAllNotificationsRead({ recipient_type = null, recipient_id = null, store_id = null } = {}) {
  try {
    const query = new URLSearchParams();
    if (recipient_type) query.set("recipient_type", recipient_type);
    if (recipient_id) query.set("recipient_id", recipient_id);
    if (store_id) query.set("store_id", store_id);

    const res = await fetch(`${API_BASE}/notifications/read-all?${query.toString()}`, { method: "POST" });
    if (!res.ok) return { success: false, count: 0 };
    return await res.json();
  } catch (e) {
    return { success: false, count: 0 };
  }
}

export async function deleteNotification(notificationId) {
  try {
    const res = await fetch(`${API_BASE}/notifications/${notificationId}`, { method: "DELETE" });
    return res.ok;
  } catch (e) {
    return false;
  }
}

export async function fetchDecisionInsights(storeId) {
  try {
    const res = await fetch(`${API_BASE}/notifications/decision-insights/${storeId}`);
    if (!res.ok) return { insights: [] };
    return await res.json();
  } catch (e) {
    return { insights: [] };
  }
}

// ============================================================================
// STORE SUBSCRIPTIONS & "MES BOUTIQUES" API
// ============================================================================

export async function subscribeToStore(storeId, customerId = null) {
  const token = getCustomerToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/stores/${storeId}/subscribe`, {
    method: "POST",
    headers,
    body: JSON.stringify({ customer_id: customerId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur lors de l'abonnement à la boutique");
  }
  return await res.json();
}

export async function unsubscribeFromStore(storeId, customerId = null) {
  const token = getCustomerToken();
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/stores/${storeId}/unsubscribe`, {
    method: "POST",
    headers,
    body: JSON.stringify({ customer_id: customerId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur lors du désabonnement");
  }
  return await res.json();
}

export async function fetchSubscriptionStatus(storeId, customerId = null) {
  try {
    const token = getCustomerToken();
    const query = new URLSearchParams();
    if (customerId) query.set("customer_id", customerId);

    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/stores/${storeId}/subscription-status?${query.toString()}`, { headers });
    if (!res.ok) return { is_subscribed: false, followers_count: 0 };
    return await res.json();
  } catch (e) {
    return { is_subscribed: false, followers_count: 0 };
  }
}

export async function fetchMyStores(customerId = null, guestToken = null) {
  try {
    const token = getCustomerToken();
    const query = new URLSearchParams();
    if (customerId) query.set("customer_id", customerId);
    if (guestToken) query.set("guest_token", guestToken);

    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/customer/my-stores?${query.toString()}`, { headers });
    if (!res.ok) return { subscribed_stores: [], recent_stores: [] };
    return await res.json();
  } catch (e) {
    return { subscribed_stores: [], recent_stores: [] };
  }
}

export async function createStoreAnnouncement(storeId, { title, content, announcement_type = "NEWS" }) {
  const res = await fetch(`${API_BASE}/stores/${storeId}/announcements`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, content, announcement_type }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur publication annonce");
  }
  return await res.json();
}

export async function fetchStoreAnnouncements(storeId) {
  try {
    const res = await fetch(`${API_BASE}/stores/${storeId}/announcements`);
    if (!res.ok) return [];
    return await res.json();
  } catch (e) {
    return [];
  }
}

// ============================================================================
// STORE QR CODES & PRINT API
// ============================================================================

export async function fetchStoreQr(storeId) {
  const res = await fetch(`${API_BASE}/stores/${storeId}/qr`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Erreur chargement QR Code");
  }
  return await res.json();
}

export async function trackQrScan(storeId, customerId = null, guestToken = null) {
  try {
    const query = new URLSearchParams();
    if (customerId) query.set("customer_id", customerId);
    if (guestToken) query.set("guest_token", guestToken);

    await fetch(`${API_BASE}/stores/${storeId}/qr/scan?${query.toString()}`, { method: "POST" });
  } catch (e) {
    // Non-blocking
  }
}






