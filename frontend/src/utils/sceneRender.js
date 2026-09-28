/**
 * Scene graph -> SVG string  /  PDF page.
 *
 * A "scene" is a plain array of nodes in MILLIMETRES (origin top-left) so that the
 * exact same drawing is shown on screen (SVG), exported to PDF and to PNG.
 *
 *  {t:"rect", x,y,w,h,r, fill, stroke, sw, op}
 *  {t:"circle", cx,cy,r, fill, stroke, sw, op}
 *  {t:"path", cmds:[["M",x,y],["L",x,y],["C",...],["Z"]], fill, stroke, sw, op, cap, join, dash}
 *  {t:"poly", pts:[[x,y]...], closed, fill, stroke, sw, op}
 *  {t:"text", x,y,s,size(pt),font:"F1|F2|F3",fill,anchor,ls(pt),op}
 *  {t:"image", x,y,w,h, asset, circle:true|false, op}
 *  {t:"link", x,y,w,h,url}
 *  {t:"g", tx,ty, clip:{x,y,w,h,r}|{cx,cy,r}, op, children:[...]}
 * fill/stroke: "#rrggbb" or {lin:[x1,y1,x2,y2],stops:[[0,c],[1,c]]} / {rad:[cx,cy,r],stops}
 */
import { rrectCmds, circleCmds, polyCmds, textWidth } from "./pdfBuilder.js";

const PT = 25.4 / 72;
const esc = (s) =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const n3 = (v) => Math.round(v * 1000) / 1000;

// ---------------------------------------------------------------------------
// SVG
// ---------------------------------------------------------------------------
function cmdsToD(cmds) {
  return cmds
    .map((c) => (c[0] === "Z" ? "Z" : c[0] + c.slice(1).map(n3).join(" ")))
    .join("");
}

export function sceneToSvg(nodes, wMm, hMm, { idPrefix = "s", background = null, extraAttrs = "" } = {}) {
  let uid = 0;
  const defs = [];
  const nextId = (k) => `${idPrefix}-${k}${uid++}`;

  const paint = (v) => {
    if (!v) return "none";
    if (typeof v === "string") return v;
    const id = nextId("g");
    const stops = v.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join("");
    if (v.rad) {
      defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${v.rad[0]}" cy="${v.rad[1]}" r="${v.rad[2]}">${stops}</radialGradient>`);
    } else {
      defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${v.lin[0]}" y1="${v.lin[1]}" x2="${v.lin[2]}" y2="${v.lin[3]}">${stops}</linearGradient>`);
    }
    return `url(#${id})`;
  };

  const common = (n) => {
    let a = `fill="${paint(n.fill)}"`;
    if (n.stroke) {
      a += ` stroke="${paint(n.stroke)}" stroke-width="${n.sw ?? 0.2}"`;
      if (n.cap) a += ` stroke-linecap="${["butt", "round", "square"][n.cap]}"`;
      if (n.join) a += ` stroke-linejoin="${["miter", "round", "bevel"][n.join]}"`;
      if (n.dash) a += ` stroke-dasharray="${n.dash.join(" ")}"`;
    }
    if (n.op !== undefined && n.op < 1) a += ` opacity="${n.op}"`;
    return a;
  };

  const render = (n) => {
    switch (n.t) {
      case "rect":
        return `<rect x="${n3(n.x)}" y="${n3(n.y)}" width="${n3(n.w)}" height="${n3(n.h)}"${n.r ? ` rx="${n.r}"` : ""} ${common(n)}/>`;
      case "circle":
        return `<circle cx="${n3(n.cx)}" cy="${n3(n.cy)}" r="${n3(n.r)}" ${common(n)}/>`;
      case "path":
        return `<path d="${cmdsToD(n.cmds)}" ${common(n)}/>`;
      case "poly":
        return `<path d="${cmdsToD(polyCmds(n.pts, n.closed))}" ${common(n)}/>`;
      case "text": {
        const font = n.font || "F1";
        const weight = font === "F2" ? ' font-weight="700"' : "";
        const style = font === "F3" ? ' font-style="italic"' : "";
        const anchor = n.anchor && n.anchor !== "start" ? ` text-anchor="${n.anchor}"` : "";
        const ls = n.ls ? ` letter-spacing="${n3(n.ls * PT)}"` : "";
        const op = n.op !== undefined && n.op < 1 ? ` opacity="${n.op}"` : "";
        return `<text x="${n3(n.x)}" y="${n3(n.y)}" font-family="Helvetica, Arial, sans-serif" font-size="${n3(n.size * PT)}"${weight}${style}${anchor}${ls}${op} fill="${paint(n.fill)}">${esc(n.s)}</text>`;
      }
      case "image": {
        if (!n.asset) return "";
        let clip = "";
        let open = "";
        let close = "";
        if (n.circle) {
          const id = nextId("c");
          defs.push(`<clipPath id="${id}"><circle cx="${n3(n.x + n.w / 2)}" cy="${n3(n.y + n.h / 2)}" r="${n3(Math.min(n.w, n.h) / 2)}"/></clipPath>`);
          open = `<g clip-path="url(#${id})">`;
          close = "</g>";
        }
        const op = n.op !== undefined && n.op < 1 ? ` opacity="${n.op}"` : "";
        return `${open}<image href="${n.asset.dataUrl}" x="${n3(n.x)}" y="${n3(n.y)}" width="${n3(n.w)}" height="${n3(n.h)}" preserveAspectRatio="xMidYMid slice"${op}${clip}/>${close}`;
      }
      case "link":
        return ""; // handled by the HTML layer on screen, by annotations in PDF
      case "g": {
        let attrs = "";
        if (n.tx || n.ty) attrs += ` transform="translate(${n3(n.tx || 0)} ${n3(n.ty || 0)})"`;
        if (n.op !== undefined && n.op < 1) attrs += ` opacity="${n.op}"`;
        if (n.clip) {
          const id = nextId("c");
          const c = n.clip;
          const shape = c.cx !== undefined
            ? `<circle cx="${c.cx}" cy="${c.cy}" r="${c.r}"/>`
            : `<rect x="${c.x}" y="${c.y}" width="${c.w}" height="${c.h}"${c.r ? ` rx="${c.r}"` : ""}/>`;
          defs.push(`<clipPath id="${id}">${shape}</clipPath>`);
          attrs += ` clip-path="url(#${id})"`;
        }
        return `<g${attrs}>${n.children.map(render).join("")}</g>`;
      }
      default:
        return "";
    }
  };

  const body = nodes.map(render).join("");
  const bg = background ? `<rect width="${wMm}" height="${hMm}" fill="${background}"/>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${wMm} ${hMm}" width="${wMm}mm" height="${hMm}mm" ` +
    `text-rendering="geometricPrecision"${extraAttrs}>` +
    `<defs>${defs.join("")}</defs>${bg}${body}</svg>`
  );
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
const pdfImageIds = new WeakMap(); // asset -> Map(doc -> id)
let imgCounter = 0;

function pdfImageId(doc, asset) {
  let m = pdfImageIds.get(asset);
  if (!m) pdfImageIds.set(asset, (m = new Map()));
  if (!m.has(doc)) m.set(doc, { id: doc.addJpeg(asset.bytes, asset.w, asset.h), name: `Im${imgCounter++}` });
  return m.get(doc);
}

function paintPdf(page, cmds, v) {
  if (!v) return false;
  if (typeof v === "string") {
    page.fill(cmds, v);
    return true;
  }
  if (v.rad) page.fillGradient(cmds, { radial: true, cx: v.rad[0], cy: v.rad[1], r: v.rad[2], stops: v.stops });
  else page.fillGradient(cmds, { x1: v.lin[0], y1: v.lin[1], x2: v.lin[2], y2: v.lin[3], stops: v.stops });
  return true;
}

function strokeColor(v) {
  if (!v) return null;
  if (typeof v === "string") return v;
  return v.stops[Math.floor(v.stops.length / 2)][1]; // gradients on strokes: use the mid colour
}

/**
 * Draw scene nodes onto a PdfPage. (tx, ty) offsets the whole scene in mm.
 */
export function sceneToPdfPage(page, nodes, doc, tx = 0, ty = 0) {
  const draw = (n) => {
    const hasOp = n.op !== undefined && n.op < 1;
    const wrap = (fn) => {
      if (hasOp) {
        page.save();
        page.opacity(n.op);
      }
      fn();
      if (hasOp) page.restore();
    };
    switch (n.t) {
      case "rect":
      case "circle":
      case "path":
      case "poly": {
        const cmds =
          n.t === "rect" ? rrectCmds(n.x, n.y, n.w, n.h, n.r || 0)
          : n.t === "circle" ? circleCmds(n.cx, n.cy, n.r)
          : n.t === "poly" ? polyCmds(n.pts, n.closed)
          : n.cmds;
        wrap(() => {
          paintPdf(page, cmds, n.fill);
          const sc = strokeColor(n.stroke);
          if (sc) page.stroke(cmds, sc, n.sw ?? 0.2, { cap: n.cap || 0, join: n.join || 0, dash: n.dash });
        });
        break;
      }
      case "text":
        wrap(() =>
          page.text(n.s, n.x, n.y, {
            size: n.size,
            font: n.font || "F1",
            color: typeof n.fill === "string" ? n.fill : strokeColor(n.fill) || "#000000",
            anchor: n.anchor || "start",
            ls: n.ls || 0,
          })
        );
        break;
      case "image": {
        if (!n.asset || !n.asset.bytes) break;
        const { id, name } = pdfImageId(doc, n.asset);
        wrap(() => {
          page.save();
          if (n.circle) page.clip(circleCmds(n.x + n.w / 2, n.y + n.h / 2, Math.min(n.w, n.h) / 2));
          else page.clip(rrectCmds(n.x, n.y, n.w, n.h, 0));
          // "slice" behaviour: cover the box, centred
          const ar = n.asset.w / n.asset.h;
          let dw = n.w;
          let dh = n.h;
          if (ar > n.w / n.h) dw = n.h * ar;
          else dh = n.w / ar;
          page.image(id, name, n.x + (n.w - dw) / 2, n.y + (n.h - dh) / 2, dw, dh);
          page.restore();
        });
        break;
      }
      case "link":
        page.link(n.x + tx, n.y + ty, n.w, n.h, n.url);
        break;
      case "g": {
        page.save();
        if (n.tx || n.ty) page.translate(n.tx || 0, n.ty || 0);
        if (hasOp) page.opacity(n.op);
        if (n.clip) {
          const c = n.clip;
          page.clip(c.cx !== undefined ? circleCmds(c.cx, c.cy, c.r) : rrectCmds(c.x, c.y, c.w, c.h, c.r || 0));
        }
        // links inside a translated group need the group offset too
        const before = page.links.length;
        n.children.forEach(draw);
        for (let i = before; i < page.links.length; i++) {
          page.links[i].x += n.tx || 0;
          page.links[i].y += n.ty || 0;
        }
        page.restore();
        break;
      }
      default:
        break;
    }
  };
  if (tx || ty) {
    page.save();
    page.translate(tx, ty);
  }
  nodes.forEach(draw);
  if (tx || ty) page.restore();
}

/** Collect link rectangles of a scene (for the on-screen clickable overlay). */
export function collectLinks(nodes, ox = 0, oy = 0, out = []) {
  for (const n of nodes) {
    if (n.t === "link") out.push({ x: n.x + ox, y: n.y + oy, w: n.w, h: n.h, url: n.url });
    else if (n.t === "g") collectLinks(n.children, ox + (n.tx || 0), oy + (n.ty || 0), out);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Browser helpers (images, downloads)
// ---------------------------------------------------------------------------
/** Load an image URL and normalise it to a white-backed JPEG (embeddable in PDF and SVG). */
export async function loadImageAsset(url, maxPx = 512) {
  if (!url || typeof document === "undefined") return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = objUrl;
    });
    const scale = Math.min(1, maxPx / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(objUrl);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
    const bin = atob(dataUrl.split(",")[1]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { dataUrl, bytes, w, h };
  } catch {
    return null;
  }
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadPdfBytes(bytes, filename) {
  downloadBlob(new Blob([bytes], { type: "application/pdf" }), filename);
}

export async function svgToPngBlob(svgString, widthPx, heightPx) {
  const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = widthPx;
    canvas.height = heightPx;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, widthPx, heightPx);
    return await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export { textWidth };
