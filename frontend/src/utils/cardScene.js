/**
 * Loyalty card design (ISO/IEC 7810 ID-1, 85.60 x 53.98 mm).
 *
 * Security features drawn on every card (they are what makes a photocopy or a
 * screenshot easy to tell apart from the original):
 *  - guilloche rosettes + wave bands generated from THE CARD NUMBER (unique per card);
 *  - microtext lines (readable only under magnification, they blur when copied);
 *  - holographic seal, foil-effect tier finish, embossed number;
 *  - authenticity code + QR code pointing to a server-side check (HMAC), so the data
 *    on the card is never trusted: the verification page shows the real record.
 */
import { encodeText, ECC_M } from "./qrEncoder.js";
import { hexToRgb, rrectCmds, textWidth } from "./pdfBuilder.js";

export const CARD_W = 85.6;
export const CARD_H = 53.98;
export const CARD_R = 3.18;
const PT = 25.4 / 72;

// ---------------------------------------------------------------------------
// colour + random helpers
// ---------------------------------------------------------------------------
const toHex = (r, g, b) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v * 255))).toString(16).padStart(2, "0")).join("");

export function mix(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return toHex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}

function luminance(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromDigits(str) {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const gcd = (a, b) => (b ? gcd(b, a % b) : a);

// ---------------------------------------------------------------------------
// tier finishes
// ---------------------------------------------------------------------------
const FINISHES = {
  bronze: { label: "BRONZE", foil: ["#ffe2c6", "#c98a55", "#ffe2c6"], text: "#ffe9d6" },
  silver: { label: "ARGENT", foil: ["#ffffff", "#b6bfcc", "#f4f6fa"], text: "#f3f6fb" },
  gold: { label: "OR", foil: ["#fff3bf", "#d9a521", "#fff3bf"], text: "#fff1b0" },
  platinum: { label: "PLATINE", foil: ["#f7f9ff", "#8ea3c9", "#e6ecfb"], text: "#eef3ff" },
};

export function tierFinish(name = "", rank = 0, count = 1) {
  const n = String(name).toLowerCase();
  let key;
  if (/plat|black|diamant|diamond|elite|élite|prestige/.test(n)) key = "platinum";
  else if (/\bgold\b|\bor\b|dor[ée]/.test(n)) key = "gold";
  else if (/silver|argent/.test(n)) key = "silver";
  else if (/bronze|membre|classic|standard/.test(n)) key = "bronze";
  else {
    const ratio = count > 1 ? rank / (count - 1) : 0;
    key = ratio >= 0.85 ? "platinum" : ratio >= 0.55 ? "gold" : ratio >= 0.25 ? "silver" : "bronze";
  }
  return { key, ...FINISHES[key] };
}

// ---------------------------------------------------------------------------
// guilloche
// ---------------------------------------------------------------------------
function hypotrochoid(cx, cy, size, R, r, d, steps) {
  const turns = r / gcd(R, r);
  const pts = [];
  const scale = size / (R - r + d);
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2 * turns;
    pts.push([
      cx + scale * ((R - r) * Math.cos(t) + d * Math.cos(((R - r) / r) * t)),
      cy + scale * ((R - r) * Math.sin(t) - d * Math.sin(((R - r) / r) * t)),
    ]);
  }
  return pts;
}

function guillocheNodes(seedStr, color, opacity) {
  const rnd = mulberry32(seedFromDigits(seedStr));
  const nodes = [];
  // Interlaced wave bands
  const bandCount = 22;
  const phase = rnd() * Math.PI * 2;
  const freq = 2.2 + rnd() * 1.6;
  const amp = 2.2 + rnd() * 1.6;
  for (let k = 0; k < bandCount; k++) {
    const pts = [];
    const y0 = -2 + (k * (CARD_H + 4)) / bandCount;
    for (let x = 0; x <= CARD_W; x += 0.7) {
      const a = (x / CARD_W) * Math.PI * 2 * freq + phase + k * 0.28;
      pts.push([x, y0 + amp * Math.sin(a) + 0.9 * Math.sin(a * 2.3 + k * 0.5)]);
    }
    nodes.push({ t: "poly", pts, stroke: color, sw: 0.07, op: opacity * 0.75 });
  }
  // Two rosettes (curve family depends on the card number)
  const rs = [3, 4, 5, 7, 8];
  for (let i = 0; i < 2; i++) {
    const r = rs[Math.floor(rnd() * rs.length)];
    const R = r * (3 + Math.floor(rnd() * 4)) + 1 + Math.floor(rnd() * 3);
    const d = r * (0.7 + rnd() * 0.7);
    const cx = i === 0 ? CARD_W * 0.78 : CARD_W * 0.18;
    const cy = i === 0 ? CARD_H * 0.34 : CARD_H * 0.9;
    const size = i === 0 ? 30 : 22;
    nodes.push({ t: "poly", pts: hypotrochoid(cx, cy, size, R, r, d, 1400), stroke: color, sw: 0.09, op: opacity });
    nodes.push({ t: "poly", pts: hypotrochoid(cx, cy, size * 0.62, R, r, d * 0.9, 1000), stroke: color, sw: 0.07, op: opacity * 0.8 });
  }
  return nodes;
}

// ---------------------------------------------------------------------------
// small drawing helpers
// ---------------------------------------------------------------------------
function fitSize(text, font, maxMm, startPt, minPt, lsPt = 0) {
  let size = startPt;
  while (size > minPt && textWidth(text, font, size * PT, lsPt * PT) > maxMm) size -= 0.25;
  return size;
}

function clipText(text, font, sizePt, maxMm, lsPt = 0) {
  let s = String(text);
  if (textWidth(s, font, sizePt * PT, lsPt * PT) <= maxMm) return s;
  while (s.length > 1 && textWidth(s + "…", font, sizePt * PT, lsPt * PT) > maxMm) s = s.slice(0, -1);
  return s.trimEnd() + "…";
}

function microtextLine(text, x, y, width, sizePt, color, op) {
  const unit = `${text} • `;
  const unitW = textWidth(unit, "F1", sizePt * PT, 0);
  const repeat = Math.ceil(width / unitW) + 1;
  return { t: "text", x, y, s: unit.repeat(repeat), size: sizePt, font: "F1", fill: color, op };
}

function qrNode(text, x, y, size, color = "#0b1220") {
  const qr = encodeText(text, ECC_M, true);
  const n = qr.size;
  const cell = size / n;
  const cmds = [];
  for (let row = 0; row < n; row++) {
    let col = 0;
    while (col < n) {
      if (qr.modules[row][col]) {
        const start = col;
        while (col < n && qr.modules[row][col]) col++;
        const x0 = x + start * cell;
        const y0 = y + row * cell;
        const x1 = x + col * cell;
        const y1 = y0 + cell;
        cmds.push(["M", x0, y0], ["L", x1, y0], ["L", x1, y1], ["L", x0, y1], ["Z"]);
      } else col++;
    }
  }
  return { t: "path", cmds, fill: color };
}

function arcPoints(cx, cy, r, a0, a1, steps = 14) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = a0 + ((a1 - a0) * i) / steps;
    pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return pts;
}

function chipNodes(x, y) {
  const w = 10.6;
  const h = 8.2;
  const gold = { lin: [x, y, x + w, y + h], stops: [[0, "#f6e39a"], [0.5, "#c9a03a"], [1, "#f1d97c"]] };
  const line = "#8a6a1c";
  return [
    { t: "rect", x, y, w, h, r: 1.5, fill: gold, stroke: line, sw: 0.15 },
    { t: "poly", pts: [[x, y + h * 0.36], [x + w * 0.34, y + h * 0.36], [x + w * 0.34, y]], stroke: line, sw: 0.13 },
    { t: "poly", pts: [[x + w, y + h * 0.36], [x + w * 0.66, y + h * 0.36], [x + w * 0.66, y]], stroke: line, sw: 0.13 },
    { t: "poly", pts: [[x, y + h * 0.64], [x + w * 0.34, y + h * 0.64], [x + w * 0.34, y + h]], stroke: line, sw: 0.13 },
    { t: "poly", pts: [[x + w, y + h * 0.64], [x + w * 0.66, y + h * 0.64], [x + w * 0.66, y + h]], stroke: line, sw: 0.13 },
    { t: "rect", x: x + w * 0.34, y: y + h * 0.22, w: w * 0.32, h: h * 0.56, r: 0.9, stroke: line, sw: 0.13 },
  ];
}

function hologramNodes(cx, cy, r) {
  const rainbow = {
    lin: [cx - r, cy - r, cx + r, cy + r],
    stops: [[0, "#7be0ff"], [0.28, "#c9a6ff"], [0.5, "#ffb8d9"], [0.72, "#ffe08a"], [1, "#8dffcf"]],
  };
  const nodes = [
    { t: "circle", cx, cy, r, fill: rainbow, op: 0.92 },
  ];
  // concentric fine rings + diffraction-like spokes
  for (let i = 1; i <= 5; i++) nodes.push({ t: "circle", cx, cy, r: (r * i) / 5.4, stroke: "#ffffff", sw: 0.08, op: 0.55 });
  for (let a = 0; a < 24; a++) {
    const t = (a / 24) * Math.PI * 2;
    nodes.push({ t: "poly", pts: [[cx + Math.cos(t) * r * 0.2, cy + Math.sin(t) * r * 0.2], [cx + Math.cos(t) * r * 0.97, cy + Math.sin(t) * r * 0.97]], stroke: "#ffffff", sw: 0.05, op: 0.4 });
  }
  nodes.push({ t: "circle", cx, cy, r, stroke: "#ffffff", sw: 0.25, op: 0.9 });
  nodes.push({ t: "text", x: cx, y: cy + 1.35, s: "GS", size: 7.4, font: "F2", fill: "#ffffff", anchor: "middle", op: 0.95 });
  nodes.push({ t: "text", x: cx, y: cy + r * 0.72, s: "VERIFIED", size: 1.9, font: "F2", fill: "#ffffff", anchor: "middle", ls: 0.4, op: 0.85 });
  return nodes;
}

function initials(name = "") {
  const p = String(name).trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || "?") + (p[1]?.[0] || "")).toUpperCase();
}

function formatMemberSince(v) {
  const d = v ? new Date(v) : null;
  if (!d || Number.isNaN(d.getTime())) return "--/--";
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`;
}

// ---------------------------------------------------------------------------
// FRONT
// ---------------------------------------------------------------------------
export function buildCardFront(card, assets = {}) {
  const store = card.store || {};
  const primary = store.primary_color || "#ec761e";
  const dark = "#0b1220";
  const base1 = mix(primary, dark, luminance(primary) > 0.6 ? 0.72 : 0.55);
  const base2 = mix(primary, dark, luminance(primary) > 0.6 ? 0.5 : 0.28);
  const tint = mix(primary, "#ffffff", 0.6);
  const finish = tierFinish(card.tier_name, card.tier_rank, card.tier_count);
  const number = card.card_number_formatted || "0000 0000 0000 0000";
  const storeName = String(store.name || "Boutique").toUpperCase();

  const nodes = [];
  nodes.push({ t: "rect", x: 0, y: 0, w: CARD_W, h: CARD_H, r: CARD_R, fill: { lin: [0, 0, CARD_W, CARD_H], stops: [[0, base1], [1, base2]] } });

  const inside = [];
  inside.push(...guillocheNodes(card.card_number || number, tint, 0.3));
  // soft sheen
  inside.push({ t: "poly", pts: [[CARD_W * 0.55, 0], [CARD_W, 0], [CARD_W, CARD_H * 0.55]], closed: true, fill: "#ffffff", op: 0.06 });
  inside.push({ t: "poly", pts: [[0, CARD_H * 0.72], [CARD_W * 0.42, CARD_H], [0, CARD_H]], closed: true, fill: "#000000", op: 0.12 });

  // store medallion
  inside.push({ t: "circle", cx: 11, cy: 11, r: 5.6, fill: finish.foil[1], op: 0.9 });
  inside.push({ t: "circle", cx: 11, cy: 11, r: 5.05, fill: "#ffffff" });
  if (assets.logo) inside.push({ t: "image", x: 6.3, y: 6.3, w: 9.4, h: 9.4, asset: assets.logo, circle: true });
  else inside.push({ t: "text", x: 11, y: 12.7, s: initials(store.name), size: 9, font: "F2", fill: primary, anchor: "middle" });

  // store name + subtitle
  const nameMax = CARD_W - 19.5 - 6 - 22;
  const nameSize = fitSize(storeName, "F2", nameMax, 10, 6, 0.3);
  inside.push({ t: "text", x: 19.5, y: 10.4, s: clipText(storeName, "F2", nameSize, nameMax, 0.3), size: nameSize, font: "F2", fill: "#ffffff", ls: 0.3 });
  inside.push({ t: "text", x: 19.5, y: 14.6, s: "CARTE DE FIDÉLITÉ", size: 4.6, font: "F1", fill: finish.text, ls: 1.3, op: 0.92 });

  // tier pill
  const tierLabel = String(card.tier_name || finish.label).toUpperCase();
  const tSize = fitSize(tierLabel, "F2", 22, 6, 4.2, 0.6);
  const tW = textWidth(tierLabel, "F2", tSize * PT, 0.6 * PT) + 6;
  inside.push({ t: "rect", x: CARD_W - 6 - tW, y: 5.4, w: tW, h: 6.4, r: 3.2, fill: "#000000", op: 0.3, stroke: finish.foil[1], sw: 0.3 });
  inside.push({ t: "text", x: CARD_W - 6 - tW / 2, y: 9.5, s: tierLabel, size: tSize, font: "F2", fill: finish.foil[0], anchor: "middle", ls: 0.6 });

  // chip + contactless
  inside.push(...chipNodes(8, 21));
  for (const [i, rad] of [2.2, 3.5, 4.8].entries()) {
    inside.push({ t: "poly", pts: arcPoints(24, 25.1, rad, -0.75, 0.75), stroke: "#ffffff", sw: 0.34, cap: 1, op: 0.85 - i * 0.1 });
  }

  // embossed number
  const nSize = 12.4;
  inside.push({ t: "text", x: 8.3, y: 39.9, s: number, size: nSize, font: "F2", fill: "#000000", ls: 1.5, op: 0.5 });
  inside.push({ t: "text", x: 7.85, y: 39.45, s: number, size: nSize, font: "F2", fill: "#ffffff", ls: 1.5, op: 0.55 });
  inside.push({ t: "text", x: 8, y: 39.65, s: number, size: nSize, font: "F2", fill: finish.foil[0], ls: 1.5 });

  // holder + member since
  const holder = clipText(String(card.holder_name || "").toUpperCase(), "F2", 7.2, 46, 0.3);
  inside.push({ t: "text", x: 8, y: 44.6, s: "TITULAIRE", size: 3.4, font: "F1", fill: finish.text, ls: 0.9, op: 0.8 });
  inside.push({ t: "text", x: 8, y: 48.6, s: holder, size: 7.2, font: "F2", fill: "#ffffff", ls: 0.3 });
  inside.push({ t: "text", x: 56, y: 44.6, s: "MEMBRE DEPUIS", size: 3.4, font: "F1", fill: finish.text, ls: 0.9, op: 0.8 });
  inside.push({ t: "text", x: 56, y: 48.6, s: formatMemberSince(card.member_since), size: 7.2, font: "F2", fill: "#ffffff", ls: 0.3 });

  // hologram + microtext
  inside.push(...hologramNodes(CARD_W - 12.5, 34.6, 6.4));
  inside.push(microtextLine(`GOTOSHOP • ${storeName} • CARTE AUTHENTIQUE`, 8, CARD_H - 2.3, CARD_W - 16, 1.9, "#ffffff", 0.55));

  nodes.push({ t: "g", clip: { x: 0, y: 0, w: CARD_W, h: CARD_H, r: CARD_R }, children: inside });
  nodes.push({ t: "rect", x: 0.1, y: 0.1, w: CARD_W - 0.2, h: CARD_H - 0.2, r: CARD_R - 0.1, stroke: "#ffffff", sw: 0.2, op: 0.35 });
  return nodes;
}

// ---------------------------------------------------------------------------
// BACK
// ---------------------------------------------------------------------------
export function buildCardBack(card, assets = {}) {
  void assets;
  const store = card.store || {};
  const primary = store.primary_color || "#ec761e";
  const dark = "#0b1220";
  const base1 = mix(primary, dark, 0.78);
  const base2 = mix(primary, dark, 0.55);
  const tint = mix(primary, "#ffffff", 0.55);
  const finish = tierFinish(card.tier_name, card.tier_rank, card.tier_count);
  const storeName = String(store.name || "Boutique").toUpperCase();
  const url = card.verify_url || "";
  let host = "gotoshop.com";
  try {
    host = new URL(url).host;
  } catch {
    /* keep default */
  }

  const inside = [];
  inside.push(...guillocheNodes(`${card.card_number}-back`, tint, 0.2));

  // magnetic stripe
  inside.push({ t: "rect", x: 0, y: 5.2, w: CARD_W, h: 9.2, fill: { lin: [0, 5.2, 0, 14.4], stops: [[0, "#101010"], [0.5, "#2b2b2b"], [1, "#101010"]] } });

  // signature panel (hatched) + holder name as typed signature
  inside.push({ t: "text", x: 6, y: 18.2, s: "SIGNATURE DU TITULAIRE", size: 3, font: "F1", fill: finish.text, ls: 0.7, op: 0.85 });
  inside.push({ t: "rect", x: 6, y: 19.2, w: 44, h: 8, r: 0.8, fill: "#ffffff" });
  const hatch = [];
  for (let x = -8; x < 46; x += 1.3) hatch.push({ t: "poly", pts: [[6 + x, 27.2], [6 + x + 8, 19.2]], stroke: "#c3cfdf", sw: 0.09 });
  inside.push({ t: "g", clip: { x: 6, y: 19.2, w: 44, h: 8, r: 0.8 }, children: hatch });
  inside.push({ t: "text", x: 9, y: 24.9, s: clipText(card.holder_name || "", "F3", 8, 38), size: 8, font: "F3", fill: "#1a2b4d" });

  // authenticity code
  const code = String(card.security_code_formatted || "").split("-");
  const line1 = code.slice(0, 2).join("-");
  const line2 = code.slice(2).join("-");
  inside.push({ t: "text", x: 53, y: 18.2, s: "CODE D'AUTHENTICITÉ", size: 3, font: "F1", fill: finish.text, ls: 0.6, op: 0.85 });
  inside.push({ t: "rect", x: 53, y: 19.2, w: 26.6, h: 8, r: 0.8, fill: "#ffffff" });
  inside.push({ t: "text", x: 66.3, y: 22.8, s: line1, size: 6.2, font: "F2", fill: "#0b1220", anchor: "middle", ls: 0.3 });
  inside.push({ t: "text", x: 66.3, y: 26.1, s: line2, size: 6.2, font: "F2", fill: "#0b1220", anchor: "middle", ls: 0.3 });

  // verification text
  inside.push({ t: "text", x: 6, y: 33.4, s: "VÉRIFIEZ L'AUTHENTICITÉ", size: 5.2, font: "F2", fill: finish.foil[0], ls: 0.5 });
  const lines = [
    "Scannez le QR code : le titulaire, le niveau et le",
    "statut sont contrôlés en direct par GotoShop.",
    "Une carte copiée ou modifiée ne sera jamais validée.",
  ];
  lines.forEach((s, i) => inside.push({ t: "text", x: 6, y: 37.3 + i * 3.1, s, size: 3.5, font: "F1", fill: "#ffffff", op: 0.88 }));
  const shown = `${host}/verify`;
  inside.push({ t: "text", x: 6, y: 47.6, s: shown, size: 4, font: "F2", fill: finish.foil[0], ls: 0.2 });
  const shownW = textWidth(shown, "F2", 4 * PT, 0.2 * PT);
  inside.push({ t: "poly", pts: [[6, 48.4], [6 + shownW, 48.4]], stroke: finish.foil[0], sw: 0.15 });
  if (url) inside.push({ t: "link", x: 5.5, y: 44.3, w: shownW + 1, h: 5, url });

  // QR (white plate = quiet zone)
  const qx = CARD_W - 6 - 22.4;
  const qy = 29.2;
  inside.push({ t: "rect", x: qx, y: qy, w: 22.4, h: 22.4, r: 1.4, fill: "#ffffff" });
  if (url) {
    inside.push(qrNode(url, qx + 1.7, qy + 1.7, 19));
    inside.push({ t: "link", x: qx, y: qy, w: 22.4, h: 22.4, url });
  }

  // serial + microtext
  inside.push({ t: "text", x: 6, y: 51.4, s: `N° ${card.card_number_formatted || ""}`, size: 3.4, font: "F1", fill: "#ffffff", ls: 0.4, op: 0.7 });
  inside.push(microtextLine(`GOTOSHOP • ${storeName} • CARTE PERSONNELLE NON TRANSFÉRABLE`, 0, 15.9, CARD_W, 1.9, "#ffffff", 0.5));
  inside.push(microtextLine(`GOTOSHOP • ${storeName} • CARTE PERSONNELLE NON TRANSFÉRABLE`, 0, CARD_H - 1.6, CARD_W - 28, 1.9, "#ffffff", 0.5));

  const nodes = [
    { t: "rect", x: 0, y: 0, w: CARD_W, h: CARD_H, r: CARD_R, fill: { lin: [0, 0, CARD_W, CARD_H], stops: [[0, base1], [1, base2]] } },
    { t: "g", clip: { x: 0, y: 0, w: CARD_W, h: CARD_H, r: CARD_R }, children: inside },
    { t: "rect", x: 0.1, y: 0.1, w: CARD_W - 0.2, h: CARD_H - 0.2, r: CARD_R - 0.1, stroke: "#ffffff", sw: 0.2, op: 0.3 },
  ];
  return nodes;
}

export { rrectCmds };
