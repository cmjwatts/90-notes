// Generates simple, valid menubar tray icons as PNGs (no external tools).
// - trayTemplate.png      18x18  black filled circle + ring (template image; macOS auto-inverts)
// - trayTemplate@2x.png   36x36
// Run: node gen-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';

mkdirSync('assets', { recursive: true });

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([lenBuf, body, crcBuf]);
}

function makePng(size) {
  // RGBA raw with per-row filter byte 0.
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const c = (size - 1) / 2;
  const rOuter = size * 0.46;
  const rInner = size * 0.30;
  let p = 0;
  for (let y = 0; y < size; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - c, y - c);
      // Filled disc with a slightly hollow center → reads as a clear "dot".
      let a = 0;
      if (d <= rOuter) a = 255;
      if (d < rInner) a = 110; // hollow-ish center for a ring-dot look
      // Template image: color is black; alpha carries the shape.
      raw[p++] = 0; raw[p++] = 0; raw[p++] = 0; raw[p++] = a;
    }
  }
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

writeFileSync('assets/trayTemplate.png', makePng(18));
writeFileSync('assets/trayTemplate@2x.png', makePng(36));
console.log('wrote assets/trayTemplate.png + @2x');
