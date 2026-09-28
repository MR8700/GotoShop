/**
 * Loyalty card exports: PDF (print sheet + one page per face at true size), SVG and PNG.
 */
import { PdfDocument } from "./pdfBuilder.js";
import { sceneToPdfPage, sceneToSvg, collectLinks, svgToPngBlob } from "./sceneRender.js";
import { buildCardFront, buildCardBack, CARD_W, CARD_H } from "./cardScene.js";

function cropMarks(x, y, w, h) {
  const len = 4;
  const gap = 1.2;
  const nodes = [];
  const mk = (x1, y1, x2, y2) => nodes.push({ t: "poly", pts: [[x1, y1], [x2, y2]], stroke: "#000000", sw: 0.15 });
  for (const [cx, cy, sx, sy] of [[x, y, -1, -1], [x + w, y, 1, -1], [x, y + h, -1, 1], [x + w, y + h, 1, 1]]) {
    mk(cx + sx * gap, cy, cx + sx * (gap + len), cy);
    mk(cx, cy + sy * gap, cx, cy + sy * (gap + len));
  }
  return nodes;
}

export function cardSvg(card, assets, side = "front") {
  const nodes = side === "back" ? buildCardBack(card, assets) : buildCardFront(card, assets);
  return sceneToSvg(nodes, CARD_W, CARD_H, { idPrefix: `card-${side}` });
}

export function cardLinks(card, assets, side = "back") {
  const nodes = side === "back" ? buildCardBack(card, assets) : buildCardFront(card, assets);
  return collectLinks(nodes);
}

export async function buildCardPdf(card, assets = {}) {
  const store = card.store?.name || "Boutique";
  const doc = new PdfDocument({
    title: `Carte de fidélité — ${store}`,
    author: store,
    subject: `Carte n° ${card.card_number_formatted}`,
    keywords: "carte de fidélité, GotoShop",
  });
  const front = buildCardFront(card, assets);
  const back = buildCardBack(card, assets);

  // Page 1: A4 print sheet, both faces at real size (85.6 x 53.98 mm) with crop marks
  const A4W = 210;
  const A4H = 297;
  const sheet = doc.addPage(A4W, A4H);
  const x = (A4W - CARD_W) / 2;
  const y1 = 48;
  const y2 = y1 + CARD_H + 24;
  sheet.text(`Carte de fidélité — ${store}`, A4W / 2, 22, { size: 16, font: "F2", color: "#0b1220", anchor: "middle" });
  sheet.text("Feuille d'impression : recto et verso à l'échelle réelle (format carte bancaire ISO/IEC 7810 ID-1)", A4W / 2, 29, { size: 8.5, color: "#475569", anchor: "middle" });
  sheet.text("RECTO", x, y1 - 4, { size: 8, font: "F2", color: "#64748b" });
  sheet.text("VERSO", x, y2 - 4, { size: 8, font: "F2", color: "#64748b" });
  sceneToPdfPage(sheet, front, doc, x, y1);
  sceneToPdfPage(sheet, back, doc, x, y2);
  cropMarks(x, y1, CARD_W, CARD_H).forEach((n) => sceneToPdfPage(sheet, [n], doc));
  cropMarks(x, y2, CARD_W, CARD_H).forEach((n) => sceneToPdfPage(sheet, [n], doc));
  const notes = [
    "Imprimer à 100 % (« taille réelle »), sans « ajuster à la page ». Papier PVC/couché 250-350 g, puis découper aux repères.",
    "Le QR code du verso est cliquable et mène à la vérification en ligne : c'est elle qui fait foi, pas l'impression.",
    "Ne modifiez ni le numéro ni le code d'authenticité : une carte altérée ne sera pas validée par GotoShop.",
  ];
  notes.forEach((t, i) => sheet.text(t, A4W / 2, y2 + CARD_H + 22 + i * 5.5, { size: 8, color: "#334155", anchor: "middle" }));
  sheet.text(`N° ${card.card_number_formatted}  •  Code ${card.security_code_formatted}`, A4W / 2, A4H - 18, { size: 8, font: "F2", color: "#0b1220", anchor: "middle" });

  // Pages 2-3: one face per page, page = card size (for print shops)
  const p2 = doc.addPage(CARD_W, CARD_H);
  sceneToPdfPage(p2, front, doc);
  const p3 = doc.addPage(CARD_W, CARD_H);
  sceneToPdfPage(p3, back, doc);
  return await doc.build();
}

export async function cardPng(card, assets, side = "front", widthPx = 1712) {
  const svg = cardSvg(card, assets, side);
  return await svgToPngBlob(svg, widthPx, Math.round((widthPx * CARD_H) / CARD_W));
}

export function downloadBlob(blob, filename = "carte-fidelite.png") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadPdfBytes(bytes, filename = "carte-fidelite.pdf") {
  const blob = new Blob([bytes], { type: "application/pdf" });
  downloadBlob(blob, filename);
}

