/**
 * Store QR Code helpers for GotoShop.
 *
 * Generates REAL, scannable QR Codes (ISO 18004) fully in the browser via
 * ./qrEncoder — no external service, works offline. (The previous version
 * only drew a placeholder pattern that phones could not read.)
 */
import { encodeText, qrToSvg, ECC_M } from "./qrEncoder";

/** Canonical public URL of a store. The SPA resolves /store/<slug>. */
export function buildStoreUrl(slugOrUrl, origin = "") {
  if (String(slugOrUrl).startsWith("http")) return String(slugOrUrl);
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "https://gotoshop.com");
  return `${base.replace(/\/$/, "")}/store/${encodeURIComponent(slugOrUrl)}`;
}

/** Scannable QR Code as a vector SVG string (fills its container). */
export function generateStoreQrSvg(slugOrUrl, origin = "", { dark = "#0f172a", title = "QR code de la boutique" } = {}) {
  const url = buildStoreUrl(slugOrUrl, origin);
  const svg = qrToSvg(encodeText(url, ECC_M, true), { dark, light: "#ffffff", title });
  return svg.replace("<svg ", '<svg width="100%" height="100%" ');
}
