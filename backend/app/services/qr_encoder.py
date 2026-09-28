"""
Real QR Code encoder (ISO/IEC 18004), pure Python, zero dependencies.

Byte mode, versions 1-40, error correction L/M/Q/H, automatic mask selection.
The output is a genuine, scannable QR Code (unlike the former placeholder matrix).

The JavaScript twin lives in frontend/src/utils/qrEncoder.js and produces
identical matrices for identical inputs.
"""
from typing import List, Optional

ECC_L, ECC_M, ECC_Q, ECC_H = 0, 1, 2, 3
_ECC_FORMAT_BITS = (1, 0, 3, 2)  # L, M, Q, H

_ECC_CODEWORDS_PER_BLOCK = (
    (-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30),
    (-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28),
    (-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30),
    (-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30),
)
_NUM_ERROR_CORRECTION_BLOCKS = (
    (-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25),
    (-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49),
    (-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68),
    (-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81),
)


def _num_raw_data_modules(ver: int) -> int:
    result = (16 * ver + 128) * ver + 64
    if ver >= 2:
        num_align = ver // 7 + 2
        result -= (25 * num_align - 10) * num_align - 55
        if ver >= 7:
            result -= 36
    return result


def _num_data_codewords(ver: int, ecl: int) -> int:
    return (
        _num_raw_data_modules(ver) // 8
        - _ECC_CODEWORDS_PER_BLOCK[ecl][ver] * _NUM_ERROR_CORRECTION_BLOCKS[ecl][ver]
    )


def _gf_mul(x: int, y: int) -> int:
    z = 0
    for i in range(7, -1, -1):
        z = (z << 1) ^ ((z >> 7) * 0x11D)
        z ^= ((y >> i) & 1) * x
    return z


def _rs_divisor(degree: int) -> List[int]:
    result = [0] * (degree - 1) + [1]
    root = 1
    for _ in range(degree):
        for j in range(degree):
            result[j] = _gf_mul(result[j], root)
            if j + 1 < degree:
                result[j] ^= result[j + 1]
        root = _gf_mul(root, 0x02)
    return result


def _rs_remainder(data: List[int], divisor: List[int]) -> List[int]:
    result = [0] * len(divisor)
    for b in data:
        factor = b ^ result.pop(0)
        result.append(0)
        for i, coef in enumerate(divisor):
            result[i] ^= _gf_mul(coef, factor)
    return result


def _alignment_positions(ver: int) -> List[int]:
    if ver == 1:
        return []
    num_align = ver // 7 + 2
    step = 26 if ver == 32 else (ver * 4 + num_align * 2 + 1) // (num_align * 2 - 2) * 2
    size = ver * 4 + 17
    result = [size - 7 - i * step for i in range(num_align - 1)] + [6]
    return list(reversed(result))


class QrCode:
    def __init__(self, ver: int, ecl: int, data_codewords: List[int]):
        self.version = ver
        self.ecl = ecl
        self.size = ver * 4 + 17
        n = self.size
        self.modules = [[False] * n for _ in range(n)]
        self._is_function = [[False] * n for _ in range(n)]

        self._draw_function_patterns()
        all_codewords = self._add_ecc_and_interleave(data_codewords)
        self._draw_codewords(all_codewords)

        best_mask, best_penalty = 0, None
        for m in range(8):
            self._apply_mask(m)
            self._draw_format_bits(m)
            p = self._penalty()
            if best_penalty is None or p < best_penalty:
                best_mask, best_penalty = m, p
            self._apply_mask(m)  # undo (XOR)
        self.mask = best_mask
        self._apply_mask(best_mask)
        self._draw_format_bits(best_mask)
        self._is_function = None

    # ---- function patterns ----
    def _set_function(self, x: int, y: int, dark: bool) -> None:
        self.modules[y][x] = dark
        self._is_function[y][x] = True

    def _draw_function_patterns(self) -> None:
        n = self.size
        for i in range(n):
            self._set_function(6, i, i % 2 == 0)
            self._set_function(i, 6, i % 2 == 0)
        self._draw_finder(3, 3)
        self._draw_finder(n - 4, 3)
        self._draw_finder(3, n - 4)
        pos = _alignment_positions(self.version)
        last = len(pos) - 1
        for i in range(len(pos)):
            for j in range(len(pos)):
                if not ((i == 0 and j == 0) or (i == 0 and j == last) or (i == last and j == 0)):
                    self._draw_alignment(pos[i], pos[j])
        self._draw_format_bits(0)
        self._draw_version()

    def _draw_finder(self, cx: int, cy: int) -> None:
        for dy in range(-4, 5):
            for dx in range(-4, 5):
                dist = max(abs(dx), abs(dy))
                xx, yy = cx + dx, cy + dy
                if 0 <= xx < self.size and 0 <= yy < self.size:
                    self._set_function(xx, yy, dist not in (2, 4))

    def _draw_alignment(self, cx: int, cy: int) -> None:
        for dy in range(-2, 3):
            for dx in range(-2, 3):
                self._set_function(cx + dx, cy + dy, max(abs(dx), abs(dy)) != 1)

    def _draw_format_bits(self, mask: int) -> None:
        data = _ECC_FORMAT_BITS[self.ecl] << 3 | mask
        rem = data
        for _ in range(10):
            rem = (rem << 1) ^ ((rem >> 9) * 0x537)
        bits = (data << 10 | rem) ^ 0x5412
        bit = lambda i: ((bits >> i) & 1) != 0
        n = self.size
        for i in range(6):
            self._set_function(8, i, bit(i))
        self._set_function(8, 7, bit(6))
        self._set_function(8, 8, bit(7))
        self._set_function(7, 8, bit(8))
        for i in range(9, 15):
            self._set_function(14 - i, 8, bit(i))
        for i in range(8):
            self._set_function(n - 1 - i, 8, bit(i))
        for i in range(8, 15):
            self._set_function(8, n - 15 + i, bit(i))
        self._set_function(8, n - 8, True)

    def _draw_version(self) -> None:
        if self.version < 7:
            return
        rem = self.version
        for _ in range(12):
            rem = (rem << 1) ^ ((rem >> 11) * 0x1F25)
        bits = self.version << 12 | rem
        n = self.size
        for i in range(18):
            bit = ((bits >> i) & 1) != 0
            a = n - 11 + i % 3
            b = i // 3
            self._set_function(a, b, bit)
            self._set_function(b, a, bit)

    # ---- data ----
    def _add_ecc_and_interleave(self, data: List[int]) -> List[int]:
        ver, ecl = self.version, self.ecl
        num_blocks = _NUM_ERROR_CORRECTION_BLOCKS[ecl][ver]
        block_ecc_len = _ECC_CODEWORDS_PER_BLOCK[ecl][ver]
        raw = _num_raw_data_modules(ver) // 8
        num_short = num_blocks - raw % num_blocks
        short_len = raw // num_blocks
        blocks = []
        rs = _rs_divisor(block_ecc_len)
        k = 0
        for i in range(num_blocks):
            dat = data[k:k + short_len - block_ecc_len + (0 if i < num_short else 1)]
            k += len(dat)
            ecc = _rs_remainder(dat, rs)
            if i < num_short:
                dat = dat + [0]
            blocks.append(dat + ecc)
        result = []
        for i in range(len(blocks[0])):
            for j, blk in enumerate(blocks):
                if i != short_len - block_ecc_len or j >= num_short:
                    result.append(blk[i])
        return result

    def _draw_codewords(self, data: List[int]) -> None:
        n = self.size
        i = 0
        right = n - 1
        while right >= 1:
            if right == 6:
                right = 5
            for vert in range(n):
                for j in range(2):
                    x = right - j
                    upward = ((right + 1) & 2) == 0
                    y = n - 1 - vert if upward else vert
                    if not self._is_function[y][x] and i < len(data) * 8:
                        self.modules[y][x] = ((data[i >> 3] >> (7 - (i & 7))) & 1) != 0
                        i += 1
            right -= 2

    def _apply_mask(self, mask: int) -> None:
        n = self.size
        for y in range(n):
            for x in range(n):
                if mask == 0: inv = (x + y) % 2 == 0
                elif mask == 1: inv = y % 2 == 0
                elif mask == 2: inv = x % 3 == 0
                elif mask == 3: inv = (x + y) % 3 == 0
                elif mask == 4: inv = (x // 3 + y // 2) % 2 == 0
                elif mask == 5: inv = x * y % 2 + x * y % 3 == 0
                elif mask == 6: inv = (x * y % 2 + x * y % 3) % 2 == 0
                else: inv = ((x + y) % 2 + x * y % 3) % 2 == 0
                if inv and not self._is_function[y][x]:
                    self.modules[y][x] = not self.modules[y][x]

    def _penalty(self) -> int:
        n = self.size
        m = self.modules
        pen = 0
        # N1: runs of >= 5 same-colour modules (rows and columns)
        for horizontal in (True, False):
            for a in range(n):
                run = 1
                for b in range(1, n):
                    cur = m[a][b] if horizontal else m[b][a]
                    prev = m[a][b - 1] if horizontal else m[b - 1][a]
                    if cur == prev:
                        run += 1
                    else:
                        if run >= 5:
                            pen += run - 2
                        run = 1
                if run >= 5:
                    pen += run - 2
        # N2: 2x2 blocks
        for y in range(n - 1):
            for x in range(n - 1):
                c = m[y][x]
                if c == m[y][x + 1] == m[y + 1][x] == m[y + 1][x + 1]:
                    pen += 3
        # N3: finder-like patterns
        p1 = [True, False, True, True, True, False, True, False, False, False, False]
        p2 = [False, False, False, False, True, False, True, True, True, False, True]
        for horizontal in (True, False):
            for a in range(n):
                line = m[a] if horizontal else [m[b][a] for b in range(n)]
                for s in range(n - 10):
                    seg = line[s:s + 11]
                    if seg == p1 or seg == p2:
                        pen += 40
        # N4: dark/light balance
        dark = sum(1 for row in m for v in row if v)
        total = n * n
        k = (abs(dark * 20 - total * 10) + total - 1) // total - 1
        pen += max(k, 0) * 10
        return pen

    def get_module(self, x: int, y: int) -> bool:
        return 0 <= x < self.size and 0 <= y < self.size and self.modules[y][x]


def encode_text(text: str, ecl: int = ECC_M, boost_ecl: bool = True, min_version: int = 1) -> QrCode:
    """Encode `text` (UTF-8, byte mode) into a QR Code."""
    data = text.encode("utf-8")
    ver = None
    for v in range(max(1, min_version), 41):
        cc_bits = 8 if v < 10 else 16
        used = 4 + cc_bits + len(data) * 8
        if used <= _num_data_codewords(v, ecl) * 8:
            ver = v
            break
    if ver is None:
        raise ValueError("Données trop volumineuses pour un QR Code")
    if boost_ecl:
        used = 4 + (8 if ver < 10 else 16) + len(data) * 8
        for new_ecl in (ECC_M, ECC_Q, ECC_H):
            if new_ecl > ecl and used <= _num_data_codewords(ver, new_ecl) * 8:
                ecl = new_ecl

    bits: List[int] = []

    def append(val: int, n: int) -> None:
        for i in range(n - 1, -1, -1):
            bits.append((val >> i) & 1)

    append(0x4, 4)
    append(len(data), 8 if ver < 10 else 16)
    for b in data:
        append(b, 8)
    capacity = _num_data_codewords(ver, ecl) * 8
    append(0, min(4, capacity - len(bits)))
    append(0, -len(bits) % 8)
    pad = 0xEC
    while len(bits) < capacity:
        append(pad, 8)
        pad ^= 0xEC ^ 0x11
    codewords = [0] * (len(bits) // 8)
    for i, b in enumerate(bits):
        codewords[i >> 3] |= b << (7 - (i & 7))
    return QrCode(ver, ecl, codewords)


def _xml_escape(text: str) -> str:
    return (str(text).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def to_svg_path(qr: QrCode, border: int = 4) -> str:
    """Single compact SVG path made of 1x1 squares (crisp at any size)."""
    parts = []
    for y in range(qr.size):
        x = 0
        while x < qr.size:
            if qr.modules[y][x]:
                start = x
                while x < qr.size and qr.modules[y][x]:
                    x += 1
                parts.append(f"M{start + border},{y + border}h{x - start}v1h-{x - start}z")
            else:
                x += 1
    return "".join(parts)


def to_svg(qr: QrCode, border: int = 4, dark: str = "#000000", light: Optional[str] = "#ffffff",
           title: Optional[str] = None) -> str:
    dim = qr.size + border * 2
    bg = f'<rect width="100%" height="100%" fill="{light}"/>' if light else ""
    t = f"<title>{_xml_escape(title)}</title>" if title else ""
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {dim} {dim}" '
        f'shape-rendering="crispEdges">{t}{bg}<path d="{to_svg_path(qr, border)}" fill="{dark}"/></svg>'
    )
