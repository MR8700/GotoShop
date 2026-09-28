/**
 * Minimal vector PDF writer — zero dependencies, runs in the browser and Node.
 *
 * Coordinates are in MILLIMETRES with the origin at the TOP-LEFT of the page
 * (a global matrix converts to PDF space), font sizes are in points.
 * Supports: rounded rectangles, circles, polylines/paths, clipping, linear and
 * radial gradients, opacity, standard Helvetica text (WinAnsi accents),
 * JPEG images and CLICKABLE link annotations.
 */
import { HELV, HELV_BOLD, HELV_OBLIQUE } from "./pdfFontMetrics.js";

const MM = 72 / 25.4; // points per millimetre
const PT = 25.4 / 72; // millimetres per point
const KAPPA = 0.5522847498;

const CP1252_EXTRA = {
  0x20ac: 0x80, 0x201a: 0x82, 0x0192: 0x83, 0x201e: 0x84, 0x2026: 0x85, 0x2020: 0x86, 0x2021: 0x87,
  0x02c6: 0x88, 0x2030: 0x89, 0x0160: 0x8a, 0x2039: 0x8b, 0x0152: 0x8c, 0x017d: 0x8e, 0x2018: 0x91,
  0x2019: 0x92, 0x201c: 0x93, 0x201d: 0x94, 0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x02dc: 0x98,
  0x2122: 0x99, 0x0161: 0x9a, 0x203a: 0x9b, 0x0153: 0x9c, 0x017e: 0x9e, 0x0178: 0x9f,
};

/** Unicode string -> string whose char codes are WinAnsi (cp1252) bytes. */
function toWinAnsi(str) {
  let out = "";
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    if (cp < 0x80 || (cp >= 0xa0 && cp <= 0xff)) out += String.fromCharCode(cp);
    else if (CP1252_EXTRA[cp] !== undefined) out += String.fromCharCode(CP1252_EXTRA[cp]);
    else if (cp === 0x202f || cp === 0x2009) out += " ";
    else out += "?";
  }
  return out;
}

function escapePdfString(bytesStr) {
  return bytesStr.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)").replace(/\r/g, "\\r");
}

function hexUtf16(str) {
  let hex = "FEFF";
  for (let i = 0; i < str.length; i++) hex += str.charCodeAt(i).toString(16).padStart(4, "0");
  return `<${hex}>`;
}

const num = (n) => {
  const r = Math.round(n * 1000) / 1000;
  return Object.is(r, -0) ? "0" : String(r);
};

export function hexToRgb(hex) {
  let h = String(hex || "#000000").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  if (Number.isNaN(n)) return [0, 0, 0];
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
const rgbStr = (hex) => hexToRgb(hex).map((v) => num(v)).join(" ");

const FONT_TABLES = { F1: HELV, F2: HELV_BOLD, F3: HELV_OBLIQUE };
export const FONT_NAMES = { F1: "Helvetica", F2: "Helvetica-Bold", F3: "Helvetica-Oblique" };

/** Width of `str` in the unit of `size` (size in mm gives mm). Letter spacing `ls` in same unit. */
export function textWidth(str, fontKey, size, ls = 0) {
  const table = FONT_TABLES[fontKey] || HELV;
  const s = toWinAnsi(str);
  let w = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    w += (code >= 32 ? table[code - 32] : 556) ?? 556;
  }
  return (w * size) / 1000 + ls * s.length;
}

function pathToOps(cmds) {
  // cmds: [["M",x,y],["L",x,y],["C",x1,y1,x2,y2,x,y],["Z"]]
  let ops = "";
  for (const c of cmds) {
    if (c[0] === "M") ops += `${num(c[1])} ${num(c[2])} m `;
    else if (c[0] === "L") ops += `${num(c[1])} ${num(c[2])} l `;
    else if (c[0] === "C") ops += `${num(c[1])} ${num(c[2])} ${num(c[3])} ${num(c[4])} ${num(c[5])} ${num(c[6])} c `;
    else if (c[0] === "Z") ops += "h ";
  }
  return ops;
}

export function rrectCmds(x, y, w, h, r = 0) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  if (r === 0) return [["M", x, y], ["L", x + w, y], ["L", x + w, y + h], ["L", x, y + h], ["Z"]];
  const k = r * KAPPA;
  return [
    ["M", x + r, y],
    ["L", x + w - r, y],
    ["C", x + w - r + k, y, x + w, y + r - k, x + w, y + r],
    ["L", x + w, y + h - r],
    ["C", x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h],
    ["L", x + r, y + h],
    ["C", x + r - k, y + h, x, y + h - r + k, x, y + h - r],
    ["L", x, y + r],
    ["C", x, y + r - k, x + r - k, y, x + r, y],
    ["Z"],
  ];
}

export function circleCmds(cx, cy, r) {
  const k = r * KAPPA;
  return [
    ["M", cx + r, cy],
    ["C", cx + r, cy + k, cx + k, cy + r, cx, cy + r],
    ["C", cx - k, cy + r, cx - r, cy + k, cx - r, cy],
    ["C", cx - r, cy - k, cx - k, cy - r, cx, cy - r],
    ["C", cx + k, cy - r, cx + r, cy - k, cx + r, cy],
    ["Z"],
  ];
}

export function polyCmds(points, closed = false) {
  const cmds = points.map((p, i) => [i === 0 ? "M" : "L", p[0], p[1]]);
  if (closed) cmds.push(["Z"]);
  return cmds;
}

export class PdfPage {
  constructor(doc, wMm, hMm) {
    this.doc = doc;
    this.w = wMm;
    this.h = hMm;
    this.ops = [];
    this.links = [];
    this.fonts = new Set();
    this.gstates = new Map(); // name -> opacity
    this.shadings = new Map(); // name -> shading id
    this.images = new Map(); // name -> image id
    this._gsCount = 0;
  }

  raw(s) { this.ops.push(s); }
  save() { this.raw("q"); }
  restore() { this.raw("Q"); }
  translate(x, y) { this.raw(`1 0 0 1 ${num(x)} ${num(y)} cm`); }

  opacity(a) {
    if (a === undefined || a >= 0.999) return;
    const key = `GS${num(a).replace(".", "_")}`;
    this.gstates.set(key, a);
    this.raw(`/${key} gs`);
  }

  clip(cmds) { this.raw(`${pathToOps(cmds)}W n`); }

  fill(cmds, color) {
    this.raw(`${rgbStr(color)} rg ${pathToOps(cmds)}f`);
  }

  stroke(cmds, color, width, { cap = 0, join = 0, dash = null } = {}) {
    const d = dash ? `[${dash.map(num).join(" ")}] 0 d ` : "";
    this.raw(`${rgbStr(color)} RG ${num(width)} w ${cap} J ${join} j ${d}${pathToOps(cmds)}S`);
  }

  fillStroke(cmds, fillColor, strokeColor, width) {
    this.raw(`${rgbStr(fillColor)} rg ${rgbStr(strokeColor)} RG ${num(width)} w ${pathToOps(cmds)}B`);
  }

  /** Fill `cmds` with a linear / radial gradient. */
  fillGradient(cmds, grad) {
    const id = this.doc._addShading(grad);
    const name = `Sh${id}`;
    this.shadings.set(name, id);
    this.raw(`q ${pathToOps(cmds)}W n /${name} sh Q`);
  }

  text(str, x, y, { size = 3, font = "F1", color = "#000000", anchor = "start", ls = 0 } = {}) {
    // size is in points; the page CTM is in mm.
    const sizeMm = size * PT;
    const lsMm = ls * PT;
    let w = textWidth(str, font, sizeMm, lsMm);
    let tx = x;
    if (anchor === "middle") tx = x - (w - lsMm) / 2;
    else if (anchor === "end") tx = x - (w - lsMm);
    this.fonts.add(font);
    const enc = escapePdfString(toWinAnsi(str));
    this.raw(
      `q 1 0 0 -1 ${num(tx)} ${num(y)} cm ${rgbStr(color)} rg ` +
        `BT /${font} ${num(sizeMm)} Tf ${num(lsMm)} Tc (${enc}) Tj ET Q`
    );
    return w;
  }

  image(imageId, name, x, y, w, h) {
    this.images.set(name, imageId);
    this.raw(`q ${num(w)} 0 0 ${num(-h)} ${num(x)} ${num(y + h)} cm /${name} Do Q`);
  }

  link(x, y, w, h, url) {
    this.links.push({ x, y, w, h, url });
  }
}

export class PdfDocument {
  constructor({ title = "Document", author = "GotoShop", subject = "", keywords = "" } = {}) {
    this.meta = { title, author, subject, keywords };
    this.pages = [];
    this.shadings = []; // {grad}
    this.imageStore = []; // {bytes,w,h}
  }

  addPage(wMm, hMm) {
    const page = new PdfPage(this, wMm, hMm);
    this.pages.push(page);
    return page;
  }

  /** Register a JPEG (Uint8Array) once; returns an image id. */
  addJpeg(bytes, wPx, hPx) {
    this.imageStore.push({ bytes, w: wPx, h: hPx });
    return this.imageStore.length - 1;
  }

  _addShading(grad) {
    this.shadings.push(grad);
    return this.shadings.length - 1;
  }

  async build() {
    const enc = new TextEncoder();
    const objs = []; // each: {dict:string, stream?:Uint8Array}
    const add = (dict, stream) => {
      objs.push({ dict, stream });
      return objs.length; // 1-based id
    };
    const compress = async (bytes) => {
      if (typeof CompressionStream === "undefined") return { bytes, filter: "" };
      const cs = new CompressionStream("deflate");
      const stream = new Blob([bytes]).stream().pipeThrough(cs);
      const buf = new Uint8Array(await new Response(stream).arrayBuffer());
      return { bytes: buf, filter: "/Filter /FlateDecode " };
    };
    const latin1 = (s) => {
      const out = new Uint8Array(s.length);
      for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
      return out;
    };

    // Reserve catalog + pages ids
    const catalogId = add("");
    const pagesId = add("");

    // Fonts
    const fontIds = {};
    for (const key of Object.keys(FONT_NAMES)) {
      fontIds[key] = add(`<< /Type /Font /Subtype /Type1 /BaseFont /${FONT_NAMES[key]} /Encoding /WinAnsiEncoding >>`);
    }

    // Images
    const imageObjIds = [];
    for (const img of this.imageStore) {
      const id = add(
        `<< /Type /XObject /Subtype /Image /Width ${img.w} /Height ${img.h} /ColorSpace /DeviceRGB ` +
          `/BitsPerComponent 8 /Filter /DCTDecode /Length ${img.bytes.length} >>`,
        img.bytes
      );
      imageObjIds.push(id);
    }

    // Shadings
    const shadingObjIds = [];
    for (const g of this.shadings) {
      const stops = g.stops;
      const fn = (c0, c1) => `<< /FunctionType 2 /Domain [0 1] /C0 [${rgbStr(c0)}] /C1 [${rgbStr(c1)}] /N 1 >>`;
      let fnStr;
      if (stops.length === 2) fnStr = fn(stops[0][1], stops[1][1]);
      else {
        const fns = [];
        const bounds = [];
        const encode = [];
        for (let i = 0; i < stops.length - 1; i++) {
          fns.push(fn(stops[i][1], stops[i + 1][1]));
          if (i > 0) bounds.push(num(stops[i][0]));
          encode.push("0 1");
        }
        fnStr = `<< /FunctionType 3 /Domain [0 1] /Functions [${fns.join(" ")}] /Bounds [${bounds.join(" ")}] /Encode [${encode.join(" ")}] >>`;
      }
      const coords = g.radial
        ? `[${num(g.cx)} ${num(g.cy)} 0 ${num(g.cx)} ${num(g.cy)} ${num(g.r)}]`
        : `[${num(g.x1)} ${num(g.y1)} ${num(g.x2)} ${num(g.y2)}]`;
      shadingObjIds.push(
        add(`<< /ShadingType ${g.radial ? 3 : 2} /ColorSpace /DeviceRGB /Coords ${coords} /Function ${fnStr} /Extend [true true] >>`)
      );
    }

    // Pages
    const pageIds = [];
    for (const page of this.pages) {
      const wPt = page.w * MM;
      const hPt = page.h * MM;
      const content = `${num(MM)} 0 0 ${num(-MM)} 0 ${num(hPt)} cm\n` + page.ops.join("\n");
      const { bytes, filter } = await compress(latin1(content));
      const contentId = add(`<< ${filter}/Length ${bytes.length} >>`, bytes);

      const fontRes = [...page.fonts].map((k) => `/${k} ${fontIds[k]} 0 R`).join(" ");
      const gsRes = [...page.gstates].map(([n, a]) => `/${n} << /ca ${num(a)} /CA ${num(a)} >>`).join(" ");
      const shRes = [...page.shadings].map(([n, id]) => `/${n} ${shadingObjIds[id]} 0 R`).join(" ");
      const imRes = [...page.images].map(([n, id]) => `/${n} ${imageObjIds[id]} 0 R`).join(" ");
      const resources =
        `<< /Font << ${fontRes || ""} >> ` +
        (gsRes ? `/ExtGState << ${gsRes} >> ` : "") +
        (shRes ? `/Shading << ${shRes} >> ` : "") +
        (imRes ? `/XObject << ${imRes} >> ` : "") +
        `>>`;

      const annotIds = page.links.map((l) => {
        const x1 = l.x * MM;
        const y1 = hPt - (l.y + l.h) * MM;
        const x2 = (l.x + l.w) * MM;
        const y2 = hPt - l.y * MM;
        const url = escapePdfString(toWinAnsi(l.url));
        return add(
          `<< /Type /Annot /Subtype /Link /Rect [${num(x1)} ${num(y1)} ${num(x2)} ${num(y2)}] /Border [0 0 0] ` +
            `/A << /S /URI /URI (${url}) >> >>`
        );
      });

      const pageId = add(
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${num(wPt)} ${num(hPt)}] /Resources ${resources} ` +
          `/Contents ${contentId} 0 R` +
          (annotIds.length ? ` /Annots [${annotIds.map((i) => `${i} 0 R`).join(" ")}]` : "") +
          ` >>`
      );
      pageIds.push(pageId);
    }

    const m = this.meta;
    const infoId = add(
      `<< /Title ${hexUtf16(m.title)} /Author ${hexUtf16(m.author)} /Subject ${hexUtf16(m.subject)} ` +
        `/Keywords ${hexUtf16(m.keywords)} /Creator ${hexUtf16("GotoShop")} /Producer ${hexUtf16("GotoShop PDF")} >>`
    );

    objs[catalogId - 1].dict = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1].dict = `<< /Type /Pages /Kids [${pageIds.map((i) => `${i} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

    // Serialise
    const chunks = [];
    const offsets = [];
    let pos = 0;
    const push = (u8) => {
      chunks.push(u8);
      pos += u8.length;
    };
    push(latin1("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n"));
    objs.forEach((o, i) => {
      offsets.push(pos);
      push(enc.encode(`${i + 1} 0 obj\n${o.dict}\n`));
      if (o.stream) {
        push(enc.encode("stream\n"));
        push(o.stream);
        push(enc.encode("\nendstream\n"));
      }
      push(enc.encode("endobj\n"));
    });
    const xrefPos = pos;
    let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) xref += `${String(off).padStart(10, "0")} 00000 n \n`;
    xref += `trailer\n<< /Size ${objs.length + 1} /Root ${catalogId} 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
    push(enc.encode(xref));

    const out = new Uint8Array(pos);
    let p = 0;
    for (const c of chunks) {
      out.set(c, p);
      p += c.length;
    }
    return out;
  }
}
