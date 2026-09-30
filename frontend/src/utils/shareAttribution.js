// Attribution des visites venant d'un lien de publicité produit (?c=CODE).
// - visiteur anonyme stable (dédoublonnage des vues côté serveur)
// - dernier lien cliqué retenu 7 jours : c'est à lui qu'on rattache les intentions et commandes
import safeStorage from "./safeStorage";

const VISITOR_KEY = "gotoshop_visitor_id";
const REF_KEY = "gotoshop_share_ref";
const REF_TTL_MS = 7 * 24 * 3600 * 1000;

export function getVisitorId() {
  let id = safeStorage.getItem(VISITOR_KEY);
  if (!id || !/^[A-Za-z0-9_-]{8,64}$/.test(id)) {
    const rnd = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID().replace(/-/g, "")
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
    id = `v${rnd}`.slice(0, 40);
    safeStorage.setItem(VISITOR_KEY, id);
  }
  return id;
}

export function setShareRef(ref) {
  safeStorage.setItem(REF_KEY, JSON.stringify({ ...ref, ts: Date.now() }));
}

export function getShareRef() {
  try {
    const raw = safeStorage.getItem(REF_KEY);
    if (!raw) return null;
    const ref = JSON.parse(raw);
    if (!ref?.code || Date.now() - (ref.ts || 0) > REF_TTL_MS) return null;
    return ref;
  } catch  {
    return null;
  }
}
