/**
 * Real QR Code encoder (ISO/IEC 18004) — pure JavaScript, zero dependencies.
 *
 * Byte mode (UTF-8), versions 1-40, error correction L/M/Q/H, automatic mask
 * selection. Produces genuine, scannable QR Codes. Twin of
 * backend/app/services/qr_encoder.py (identical matrices for identical input).
 */

export const ECC_L = 0;
export const ECC_M = 1;
export const ECC_Q = 2;
export const ECC_H = 3;

const ECC_FORMAT_BITS = [1, 0, 3, 2];

const ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];
const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

function numRawDataModules(ver) {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function numDataCodewords(ver, ecl) {
  return (
    Math.floor(numRawDataModules(ver) / 8) -
    ECC_CODEWORDS_PER_BLOCK[ecl][ver] * NUM_ERROR_CORRECTION_BLOCKS[ecl][ver]
  );
}

function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z & 0xff;
}

function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => {
      result[i] ^= gfMul(coef, factor);
    });
  }
  return result;
}

function alignmentPositions(ver) {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step =
    ver === 32 ? 26 : Math.floor((ver * 4 + numAlign * 2 + 1) / (numAlign * 2 - 2)) * 2;
  const size = ver * 4 + 17;
  const result = [];
  for (let i = 0; i < numAlign - 1; i++) result.push(size - 7 - i * step);
  result.push(6);
  return result.reverse();
}

export class QrCode {
  constructor(ver, ecl, dataCodewords) {
    this.version = ver;
    this.ecl = ecl;
    this.size = ver * 4 + 17;
    const n = this.size;
    this.modules = Array.from({ length: n }, () => new Array(n).fill(false));
    this._isFunction = Array.from({ length: n }, () => new Array(n).fill(false));

    this._drawFunctionPatterns();
    this._drawCodewords(this._addEccAndInterleave(dataCodewords));

    let bestMask = 0;
    let bestPenalty = null;
    for (let m = 0; m < 8; m++) {
      this._applyMask(m);
      this._drawFormatBits(m);
      const p = this._penalty();
      if (bestPenalty === null || p < bestPenalty) {
        bestMask = m;
        bestPenalty = p;
      }
      this._applyMask(m);
    }
    this.mask = bestMask;
    this._applyMask(bestMask);
    this._drawFormatBits(bestMask);
    this._isFunction = null;
  }

  getModule(x, y) {
    return x >= 0 && x < this.size && y >= 0 && y < this.size && this.modules[y][x];
  }

  _setFunction(x, y, dark) {
    this.modules[y][x] = dark;
    this._isFunction[y][x] = true;
  }

  _drawFunctionPatterns() {
    const n = this.size;
    for (let i = 0; i < n; i++) {
      this._setFunction(6, i, i % 2 === 0);
      this._setFunction(i, 6, i % 2 === 0);
    }
    this._drawFinder(3, 3);
    this._drawFinder(n - 4, 3);
    this._drawFinder(3, n - 4);
    const pos = alignmentPositions(this.version);
    const last = pos.length - 1;
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        if (!((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0))) {
          this._drawAlignment(pos[i], pos[j]);
        }
      }
    }
    this._drawFormatBits(0);
    this._drawVersion();
  }

  _drawFinder(cx, cy) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = cx + dx;
        const yy = cy + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) {
          this._setFunction(xx, yy, dist !== 2 && dist !== 4);
        }
      }
    }
  }

  _drawAlignment(cx, cy) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        this._setFunction(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }

  _drawFormatBits(mask) {
    const data = (ECC_FORMAT_BITS[this.ecl] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i) => ((bits >>> i) & 1) !== 0;
    const n = this.size;
    for (let i = 0; i <= 5; i++) this._setFunction(8, i, bit(i));
    this._setFunction(8, 7, bit(6));
    this._setFunction(8, 8, bit(7));
    this._setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this._setFunction(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) this._setFunction(n - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this._setFunction(8, n - 15 + i, bit(i));
    this._setFunction(8, n - 8, true);
  }

  _drawVersion() {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    const n = this.size;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = n - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this._setFunction(a, b, bit);
      this._setFunction(b, a, bit);
    }
  }

  _addEccAndInterleave(data) {
    const ver = this.version;
    const ecl = this.ecl;
    const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[ecl][ver];
    const blockEccLen = ECC_CODEWORDS_PER_BLOCK[ecl][ver];
    const raw = Math.floor(numRawDataModules(ver) / 8);
    const numShort = numBlocks - (raw % numBlocks);
    const shortLen = Math.floor(raw / numBlocks);
    const blocks = [];
    const rs = rsDivisor(blockEccLen);
    let k = 0;
    for (let i = 0; i < numBlocks; i++) {
      let dat = data.slice(k, k + shortLen - blockEccLen + (i < numShort ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, rs);
      if (i < numShort) dat = dat.concat([0]);
      blocks.push(dat.concat(ecc));
    }
    const result = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((blk, j) => {
        if (i !== shortLen - blockEccLen || j >= numShort) result.push(blk[i]);
      });
    }
    return result;
  }

  _drawCodewords(data) {
    const n = this.size;
    let i = 0;
    for (let right = n - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < n; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? n - 1 - vert : vert;
          if (!this._isFunction[y][x] && i < data.length * 8) {
            this.modules[y][x] = ((data[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
        }
      }
    }
  }

  _applyMask(mask) {
    const n = this.size;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        let inv;
        switch (mask) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: inv = ((((x * y) % 2) + ((x * y) % 3)) % 2) === 0; break;
          default: inv = ((((x + y) % 2) + ((x * y) % 3)) % 2) === 0; break;
        }
        if (inv && !this._isFunction[y][x]) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  _penalty() {
    const n = this.size;
    const m = this.modules;
    let pen = 0;
    // N1: runs of >= 5 same-colour modules
    for (const horizontal of [true, false]) {
      for (let a = 0; a < n; a++) {
        let run = 1;
        for (let b = 1; b < n; b++) {
          const cur = horizontal ? m[a][b] : m[b][a];
          const prev = horizontal ? m[a][b - 1] : m[b - 1][a];
          if (cur === prev) {
            run++;
          } else {
            if (run >= 5) pen += run - 2;
            run = 1;
          }
        }
        if (run >= 5) pen += run - 2;
      }
    }
    // N2: 2x2 blocks
    for (let y = 0; y < n - 1; y++) {
      for (let x = 0; x < n - 1; x++) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) pen += 3;
      }
    }
    // N3: finder-like patterns
    const p1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    const p2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    for (const horizontal of [true, false]) {
      for (let a = 0; a < n; a++) {
        for (let s = 0; s < n - 10; s++) {
          let match1 = true;
          let match2 = true;
          for (let k = 0; k < 11 && (match1 || match2); k++) {
            const v = (horizontal ? m[a][s + k] : m[s + k][a]) ? 1 : 0;
            if (v !== p1[k]) match1 = false;
            if (v !== p2[k]) match2 = false;
          }
          if (match1 || match2) pen += 40;
        }
      }
    }
    // N4: dark/light balance
    let dark = 0;
    for (const row of m) for (const v of row) if (v) dark++;
    const total = n * n;
    const k = Math.floor((Math.abs(dark * 20 - total * 10) + total - 1) / total) - 1;
    pen += Math.max(k, 0) * 10;
    return pen;
  }
}

/** Encode `text` (UTF-8, byte mode) into a QR Code. */
export function encodeText(text, ecl = ECC_M, boostEcl = true, minVersion = 1) {
  const data = Array.from(new TextEncoder().encode(String(text)));
  let ver = null;
  for (let v = Math.max(1, minVersion); v <= 40; v++) {
    const used = 4 + (v < 10 ? 8 : 16) + data.length * 8;
    if (used <= numDataCodewords(v, ecl) * 8) {
      ver = v;
      break;
    }
  }
  if (ver === null) throw new Error("Données trop volumineuses pour un QR Code");
  if (boostEcl) {
    const used = 4 + (ver < 10 ? 8 : 16) + data.length * 8;
    for (const newEcl of [ECC_M, ECC_Q, ECC_H]) {
      if (newEcl > ecl && used <= numDataCodewords(ver, newEcl) * 8) ecl = newEcl;
    }
  }

  const bits = [];
  const append = (val, n) => {
    for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  append(0x4, 4);
  append(data.length, ver < 10 ? 8 : 16);
  for (const b of data) append(b, 8);
  const capacity = numDataCodewords(ver, ecl) * 8;
  append(0, Math.min(4, capacity - bits.length));
  append(0, (8 - (bits.length % 8)) % 8);
  let pad = 0xec;
  while (bits.length < capacity) {
    append(pad, 8);
    pad ^= 0xec ^ 0x11;
  }
  const codewords = new Array(bits.length / 8).fill(0);
  bits.forEach((b, i) => {
    codewords[i >>> 3] |= b << (7 - (i & 7));
  });
  return new QrCode(ver, ecl, codewords);
}

/** Single compact SVG path of 1x1 squares (crisp at any size, quiet zone included). */
export function qrToSvgPath(qr, border = 4) {
  const parts = [];
  for (let y = 0; y < qr.size; y++) {
    let x = 0;
    while (x < qr.size) {
      if (qr.modules[y][x]) {
        const start = x;
        while (x < qr.size && qr.modules[y][x]) x++;
        parts.push(`M${start + border},${y + border}h${x - start}v1h-${x - start}z`);
      } else {
        x++;
      }
    }
  }
  return parts.join("");
}

export function qrToSvg(qr, { border = 4, dark = "#000000", light = "#ffffff", title = "" } = {}) {
  const dim = qr.size + border * 2;
  const bg = light ? `<rect width="100%" height="100%" fill="${light}"/>` : "";
  const esc = (s) =>
    String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const t = title ? `<title>${esc(title)}</title>` : "";
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">` +
    `${t}${bg}<path d="${qrToSvgPath(qr, border)}" fill="${dark}"/></svg>`
  );
}

/** Plain boolean matrix (rows of booleans), handy for canvas / PDF drawing. */
export function qrToMatrix(qr) {
  return qr.modules.map((row) => row.slice());
}
