// Authentification sans mot de passe (Passkeys / WebAuthn).
// GotoShop ne voit JAMAIS l'empreinte, le visage ni le PIN : le système de l'appareil les vérifie localement
// et ne renvoie qu'une preuve cryptographique (signature) que le serveur contrôle.
import { API_BASE, getCustomerToken, markCustomerSession, dataCache, dispatchStateEvent } from "./client";
import safeStorage from "../utils/safeStorage";

const b64urlToBuf = (s) => {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob((s + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)).buffer;
};
const bufToB64url = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

export const passkeysSupported = () =>
  typeof window !== "undefined" && !!window.PublicKeyCredential && !!navigator.credentials;

async function call(path, { method = "GET", body, recoveryToken, auth = true } = {}) {
  const headers = { "Content-Type": "application/json" };
  const token = getCustomerToken();
  if (auth && token && !recoveryToken) headers.Authorization = `Bearer ${token}`;
  if (recoveryToken) headers["X-Recovery-Token"] = recoveryToken;
  const res = await fetch(`${API_BASE}${path}`, { method, headers, credentials: "include", body: body ? JSON.stringify(body) : undefined });
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  if (!res.ok) {
    const e = new Error(typeof data.detail === "string" ? data.detail : `Erreur ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

const toCreationOptions = (o) => ({
  ...o,
  challenge: b64urlToBuf(o.challenge),
  user: { ...o.user, id: b64urlToBuf(o.user.id) },
  excludeCredentials: (o.excludeCredentials || []).map((c) => ({ ...c, id: b64urlToBuf(c.id) })),
});
const toRequestOptions = (o) => ({
  ...o,
  challenge: b64urlToBuf(o.challenge),
  allowCredentials: (o.allowCredentials || []).map((c) => ({ ...c, id: b64urlToBuf(c.id) })),
});

const explain = (err) => {
  if (err?.name === "NotAllowedError") return new Error("Opération annulée ou expirée. Réessayez.");
  if (err?.name === "InvalidStateError") return new Error("Cet appareil a déjà une Passkey pour ce compte.");
  if (err?.name === "NotSupportedError") return new Error("Cet appareil ne permet pas les Passkeys.");
  return err;
};

function rememberSession(data) {
  if (data.access_token || data.session_started || data.customer) markCustomerSession(data.access_token);
  if (data.customer) safeStorage.setItem("gatoshop_local_customer", JSON.stringify(data.customer));
  dataCache.invalidate("customer:stats:");
  dataCache.invalidate("customer:orders:");
  dispatchStateEvent("gotoshop:customer_updated", data.customer);
}

/** Crée une Passkey. `recoveryToken` : jeton limité obtenu avec un code de récupération (nouvel appareil). */
export async function registerPasskey({ friendlyName, recoveryToken } = {}) {
  if (!passkeysSupported()) throw new Error("Les Passkeys ne sont pas disponibles sur ce navigateur.");
  const { challenge_id, options } = await call("/auth/passkeys/register/options", { method: "POST", recoveryToken });
  let cred;
  try {
    cred = await navigator.credentials.create({ publicKey: toCreationOptions(options) });
  } catch (e) { throw explain(e); }
  const credential = {
    id: cred.id,
    rawId: bufToB64url(cred.rawId),
    type: cred.type,
    response: {
      clientDataJSON: bufToB64url(cred.response.clientDataJSON),
      attestationObject: bufToB64url(cred.response.attestationObject),
      transports: cred.response.getTransports ? cred.response.getTransports() : [],
    },
  };
  const data = await call("/auth/passkeys/register/verify", {
    method: "POST", recoveryToken,
    body: { challenge_id, credential, friendly_name: friendlyName || guessDeviceName() },
  });
  if (data.access_token || data.session_started) rememberSession(data);
  return data; // { passkey, recovery_codes? (première configuration), access_token? (récupération) }
}

/** Connexion en un geste : le système affiche empreinte / visage / PIN / gestionnaire de Passkeys. */
export async function loginWithPasskey() {
  if (!passkeysSupported()) throw new Error("Les Passkeys ne sont pas disponibles sur ce navigateur.");
  const { challenge_id, options } = await call("/auth/passkeys/login/options", { method: "POST", auth: false });
  let a;
  try {
    a = await navigator.credentials.get({ publicKey: toRequestOptions(options) });
  } catch (e) { throw explain(e); }
  const credential = {
    id: a.id,
    rawId: bufToB64url(a.rawId),
    type: a.type,
    response: {
      clientDataJSON: bufToB64url(a.response.clientDataJSON),
      authenticatorData: bufToB64url(a.response.authenticatorData),
      signature: bufToB64url(a.response.signature),
      userHandle: a.response.userHandle ? bufToB64url(a.response.userHandle) : null,
    },
  };
  const data = await call("/auth/passkeys/login/verify", { method: "POST", auth: false, body: { challenge_id, credential } });
  rememberSession(data);
  return data.customer;
}

export const consumeRecoveryCode = (phone, code) =>
  call("/auth/recovery-codes/use", { method: "POST", auth: false, body: { phone, code } });
export const useRecoveryCode = consumeRecoveryCode;
export const listPasskeys = () => call("/auth/passkeys").then((d) => d.passkeys);
export const renamePasskey = (id, friendly_name) => call(`/auth/passkeys/${id}`, { method: "PATCH", body: { friendly_name } });
export const revokePasskey = (id) => call(`/auth/passkeys/${id}`, { method: "DELETE" });
export const generateRecoveryCodes = () => call("/auth/recovery-codes/generate", { method: "POST" }).then((d) => d.codes);
export const recoveryCodesStatus = () => call("/auth/recovery-codes/status");
export const revokeAllSessions = () => call("/auth/sessions/revoke-all", { method: "POST" });

function guessDeviceName() {
  const ua = navigator.userAgent || "";
  if (/Android/i.test(ua)) return "Téléphone Android";
  if (/iPhone|iPad/i.test(ua)) return "iPhone / iPad";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Ordinateur Windows";
  return "Appareil";
}
