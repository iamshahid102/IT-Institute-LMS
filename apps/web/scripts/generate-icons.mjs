/**
 * Generates the PWA icon set without external image dependencies.
 * Run with: node scripts/generate-icons.mjs
 */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const TEAL = [15, 118, 110];
const WHITE = [255, 255, 255];
const GOLD = [214, 178, 94];

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeBuffer = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
}

function inRoundedSquare(x, y, size, radius) {
  const min = radius;
  const max = size - radius;
  const cx = Math.min(Math.max(x, min), max);
  const cy = Math.min(Math.max(y, min), max);
  return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
}

/** Mortarboard mark drawn from simple geometry, supersampled 3x3 for smooth edges. */
function mark(x, y, size, forMaskable) {
  const unit = size / 100;
  const scale = forMaskable ? 0.78 : 0.86;
  const ox = size / 2;
  const oy = size * (forMaskable ? 0.5 : 0.5);
  const px = (x - ox) / scale + ox;
  const py = (y - oy) / scale + oy;

  const boardCx = 50 * unit;
  const boardCy = 44 * unit;
  const halfW = 27 * unit;
  const halfH = 11 * unit;
  const dx = Math.abs(px - boardCx) / halfW;
  const dy = Math.abs(py - boardCy) / halfH;
  if (dx + dy <= 1) return WHITE;

  // Cap base under the board
  if (py > boardCy && py <= 58 * unit && Math.abs(px - boardCx) <= (17 - (py - boardCy) / unit / 20) * unit) {
    return WHITE;
  }

  // Tassel
  if (px > 75 * unit && px < 78.5 * unit && py > 44 * unit && py < 62 * unit) return GOLD;
  const tasselDx = px - 76.7 * unit;
  const tasselDy = py - 63.5 * unit;
  if (tasselDx ** 2 + tasselDy ** 2 <= (4.6 * unit) ** 2) return GOLD;

  return null;
}

function render(size, { maskable = false, rounded = true } = {}) {
  const radius = rounded ? size * 0.22 : 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  let offset = 0;

  for (let y = 0; y < size; y += 1) {
    raw[offset] = 0; // filter type: none
    offset += 1;
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < 3; sy += 1) {
        for (let sx = 0; sx < 3; sx += 1) {
          const px = x + (sx + 0.5) / 3;
          const py = y + (sy + 0.5) / 3;
          const inside = !rounded || inRoundedSquare(px, py, size, radius);
          if (!inside) continue;
          const color = mark(px, py, size, maskable);
          const [cr, cg, cb] = color ?? TEAL;
          r += cr;
          g += cg;
          b += cb;
          a += 255;
        }
      }

      const samples = 9;
      raw[offset] = Math.round(r / samples);
      raw[offset + 1] = Math.round(g / samples);
      raw[offset + 2] = Math.round(b / samples);
      raw[offset + 3] = Math.round(a / samples);
      offset += 4;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // RGBA
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    signature,
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = path.resolve(process.cwd(), 'public/icons');
mkdirSync(outDir, { recursive: true });

const files = [
  ['icon-192.png', render(192)],
  ['icon-512.png', render(512)],
  ['maskable-512.png', render(512, { maskable: true, rounded: false })],
  ['apple-touch-icon.png', render(180, { rounded: false })],
  ['favicon-32.png', render(32)],
];

for (const [name, buffer] of files) {
  writeFileSync(path.join(outDir, name), buffer);
  console.log(`wrote icons/${name} (${buffer.length} bytes)`);
}
