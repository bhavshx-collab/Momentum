// generate-icons.js
// Run once with: node generate-icons.js
// Generates all 4 PWA icon PNGs using Canvas API (built into Node 18+)
// If canvas module is missing, falls back to pure-JS PNG encoder

const fs = require('fs');
const path = require('path');
const { createCanvas } = (() => {
  try { return require('canvas'); } catch { return null; }
})() || {};

const OUT = path.join(__dirname, 'icons');
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

// ── Minimal PNG encoder (pure JS, no deps) ──────────────────────────────
// Used as fallback when 'canvas' npm package is not installed.
function deflate(data) {
  // Zlib deflate using Node's built-in zlib
  const zlib = require('zlib');
  return zlib.deflateSync(data, { level: 9 });
}
function crc32(buf) {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (~crc) >>> 0;
}
function uint32be(n) { const b = Buffer.alloc(4); b.writeUInt32BE(n); return b; }
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = uint32be(data.length);
  const crc = uint32be(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

function makePng(width, height, drawFn) {
  // Each pixel is RGBA (4 bytes). Build raw image data.
  const pixels = new Uint8Array(width * height * 4);
  // drawFn fills pixels[y*width*4 + x*4 .. +3] = [r,g,b,a]
  drawFn(pixels, width, height);

  // Filter bytes (PNG filter type 0 = None for each row)
  const rawRows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 4);
    row[0] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      const src = (y * width + x) * 4;
      row[1 + x * 4 + 0] = pixels[src + 0];
      row[1 + x * 4 + 1] = pixels[src + 1];
      row[1 + x * 4 + 2] = pixels[src + 2];
      row[1 + x * 4 + 3] = pixels[src + 3];
    }
    rawRows.push(row);
  }
  const raw = Buffer.concat(rawRows);
  const compressed = deflate(raw);

  const IHDR = Buffer.alloc(13);
  IHDR.writeUInt32BE(width, 0);
  IHDR.writeUInt32BE(height, 4);
  IHDR[8] = 8;  // bit depth
  IHDR[9] = 6;  // color type: RGBA
  IHDR[10] = 0; IHDR[11] = 0; IHDR[12] = 0;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    chunk('IHDR', IHDR),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Drawing routines ─────────────────────────────────────────────────────
// Draw the Momentum icon: dark background + purple-to-blue "M↗" shape

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function srgb(c) { return Math.round(clamp(c, 0, 255)); }

// Gradient color along the icon shape (left=purple, right=blue)
function gradColor(tx) {
  // Purple #8b5cf6 → Blue #3b82f6
  const r = lerp(0x8b, 0x3b, tx);
  const g = lerp(0x5c, 0x82, tx);
  const b = lerp(0xf6, 0xf6, tx);
  return [srgb(r), srgb(g), srgb(b)];
}

function drawMomentumIcon(pixels, W, H, isMaskable) {
  const pad = isMaskable ? 0.18 : 0.10; // extra padding for maskable safe-zone
  const x0 = Math.round(W * pad);
  const y0 = Math.round(H * pad);
  const iW = W - 2 * x0;
  const iH = H - 2 * y0;

  function setPixel(x, y, r, g, b, a = 255) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 4;
    // Alpha blend over existing
    const oa = pixels[i + 3] / 255;
    const na = a / 255;
    const fa = na + oa * (1 - na);
    if (fa < 0.001) return;
    pixels[i + 0] = srgb((r * na + pixels[i + 0] * oa * (1 - na)) / fa);
    pixels[i + 1] = srgb((g * na + pixels[i + 1] * oa * (1 - na)) / fa);
    pixels[i + 2] = srgb((b * na + pixels[i + 2] * oa * (1 - na)) / fa);
    pixels[i + 3] = srgb(fa * 255);
  }

  // Background
  const bgR = 5, bgG = 9, bgB = 18;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Rounded corners for non-maskable
      let r = isMaskable ? 0 : W * 0.18;
      let inCorner = false;
      if (!isMaskable) {
        const cx = x < r ? r : (x > W - r ? W - r : x);
        const cy = y < r ? r : (y > H - r ? H - r : y);
        const dx = x - cx, dy = y - cy;
        inCorner = (dx * dx + dy * dy > r * r);
      }
      if (inCorner) {
        // Transparent outside rounded rect
      } else {
        const i = (y * W + x) * 4;
        pixels[i + 0] = bgR;
        pixels[i + 1] = bgG;
        pixels[i + 2] = bgB;
        pixels[i + 3] = 255;
      }
    }
  }

  // Draw thick line between two points with given thickness
  function drawLine(x1, y1, x2, y2, thick, tx1, tx2) {
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.ceil(len * 2);
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const tx = lerp(tx1, tx2, t);
      const [cr, cg, cb] = gradColor(tx);
      for (let oy = -thick; oy <= thick; oy++) {
        for (let ox = -thick; ox <= thick; ox++) {
          if (ox * ox + oy * oy <= thick * thick) {
            const aa = 1 - Math.max(0, Math.sqrt(ox*ox+oy*oy) - (thick - 1));
            setPixel(Math.round(px + ox), Math.round(py + oy), cr, cg, cb, srgb(aa * 255));
          }
        }
      }
    }
  }

  const T = iW * 0.095; // stroke thickness relative to icon width

  // M shape: left leg down, center V, right leg up with arrow
  // Points as fractions of icon area
  const pts = (fx, fy) => [x0 + fx * iW, y0 + fy * iH];

  const [lx, ly] = pts(0.0, 1.0);  // bottom left
  const [lmx, lmy] = pts(0.15, 0.25); // left peak of M
  const [mx, my] = pts(0.38, 0.72); // center dip of M
  const [rmx, rmy] = pts(0.55, 0.20); // right peak of M (also arrow base)
  const [rx, ry] = pts(1.0, 0.0);   // top right (arrow tip)

  drawLine(lx, ly, lmx, lmy, T, 0.0, 0.18);
  drawLine(lmx, lmy, mx, my, T, 0.18, 0.40);
  drawLine(mx, my, rmx, rmy, T, 0.40, 0.60);
  drawLine(rmx, rmy, rx, ry, T, 0.60, 1.0);

  // Arrow head at top-right
  const aSize = iW * 0.18;
  const ax = x0 + iW, ay = y0; // tip
  drawLine(ax, ay, ax - aSize * 0.85, ay, aSize * 0.4, 0.9, 1.0);   // horizontal arm
  drawLine(ax, ay, ax, ay + aSize * 0.85, aSize * 0.4, 0.9, 1.0);   // vertical arm
}

// ── Generate all 4 icons ──────────────────────────────────────────────────
const icons = [
  { name: 'icon-192.png',          size: 192, maskable: false },
  { name: 'icon-512.png',          size: 512, maskable: false },
  { name: 'icon-192-maskable.png', size: 192, maskable: true },
  { name: 'icon-512-maskable.png', size: 512, maskable: true },
];

for (const { name, size, maskable } of icons) {
  const png = makePng(size, size, (pixels, W, H) => {
    drawMomentumIcon(pixels, W, H, maskable);
  });
  fs.writeFileSync(path.join(OUT, name), png);
  console.log(`✅ Generated ${name} (${size}×${size})`);
}

console.log('\n🎉 All icons generated in /icons/');
