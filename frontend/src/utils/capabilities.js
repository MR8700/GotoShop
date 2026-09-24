/**
 * Frontend Polymorphic Capability Engine for GotoShop.
 * Determines what features, screens, and actions are rendered based on store capabilities.
 */

export const CAP_PRODUCT_CATALOG = "PRODUCT_CATALOG";
export const CAP_MENU = "MENU";
export const CAP_CUSTOM_ORDER = "CUSTOM_ORDER";
export const CAP_ORDERING = "ORDERING";
export const CAP_PAYMENT_PROOF = "PAYMENT_PROOF";
export const CAP_DELIVERY = "DELIVERY";
export const CAP_FOLLOWERS = "FOLLOWERS";
export const CAP_STORE_NEWS = "STORE_NEWS";
export const CAP_MESSAGING = "MESSAGING";
export const CAP_VOICE_CALL = "VOICE_CALL";
export const CAP_QR_ACCESS = "QR_ACCESS";
export const CAP_REVIEWS = "REVIEWS";
export const CAP_LOYALTY = "LOYALTY";
export const CAP_DECISION_SUPPORT = "DECISION_SUPPORT";

export const DEFAULT_CAPABILITIES_BY_ACTIVITY = {
  RESTAURANT: [
    CAP_MENU,
    CAP_CUSTOM_ORDER,
    CAP_ORDERING,
    CAP_PAYMENT_PROOF,
    CAP_DELIVERY,
    CAP_FOLLOWERS,
    CAP_STORE_NEWS,
    CAP_MESSAGING,
    CAP_VOICE_CALL,
    CAP_QR_ACCESS,
    CAP_REVIEWS,
    CAP_DECISION_SUPPORT,
  ],
  FOOD_COMMERCE: [
    CAP_PRODUCT_CATALOG,
    CAP_ORDERING,
    CAP_PAYMENT_PROOF,
    CAP_DELIVERY,
    CAP_FOLLOWERS,
    CAP_STORE_NEWS,
    CAP_MESSAGING,
    CAP_QR_ACCESS,
    CAP_REVIEWS,
  ],
  FASHION: [
    CAP_PRODUCT_CATALOG,
    CAP_CUSTOM_ORDER,
    CAP_ORDERING,
    CAP_PAYMENT_PROOF,
    CAP_DELIVERY,
    CAP_FOLLOWERS,
    CAP_STORE_NEWS,
    CAP_MESSAGING,
    CAP_QR_ACCESS,
    CAP_REVIEWS,
    CAP_LOYALTY,
  ],
  GENERAL_COMMERCE: [
    CAP_PRODUCT_CATALOG,
    CAP_ORDERING,
    CAP_PAYMENT_PROOF,
    CAP_DELIVERY,
    CAP_FOLLOWERS,
    CAP_STORE_NEWS,
    CAP_MESSAGING,
    CAP_QR_ACCESS,
    CAP_REVIEWS,
  ],
};

/**
 * Check if a store has a given capability active.
 * Looks into store.capabilities (array or json), falling back to activity_type or default true.
 */
export function hasCapability(store, capability) {
  if (!store) return true;

  if (store.capabilities) {
    if (Array.isArray(store.capabilities)) {
      return store.capabilities.includes(capability);
    }
    if (typeof store.capabilities === "object") {
      return Boolean(store.capabilities[capability]);
    }
  }

  // Infer from activity_type
  const act = (store.activity_type || "GENERAL_COMMERCE").toUpperCase();
  const defaults = DEFAULT_CAPABILITIES_BY_ACTIVITY[act] || DEFAULT_CAPABILITIES_BY_ACTIVITY.GENERAL_COMMERCE;
  return defaults.includes(capability);
}
