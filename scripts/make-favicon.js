/**
 * Builds public/favicon.ico from the square PNG icon.
 *
 * The file that used to sit there was a byte-identical copy of logo.png with
 * an .ico extension: PNG magic bytes, 263x191, not square and not an icon.
 * Vercel types it from the extension as image/vnd.microsoft.icon, and the site
 * sends X-Content-Type-Options: nosniff, so the browser is not allowed to
 * notice it is really a PNG - it just fails to decode and shows nothing.
 *
 * Run with: node scripts/make-favicon.js
 */
import sharp from 'sharp';
import { writeFileSync } from 'node:fs';

const SRC = 'public/favicon-192x192.png';
const SIZES = [16, 32, 48];

const meta = await sharp(SRC).metadata();
console.log('source:', `${meta.width}x${meta.height}`, meta.format);

const pngs = await Promise.all(
  SIZES.map(s => sharp(SRC)
    .resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()),
);

const header = Buffer.alloc(6);
header.writeUInt16LE(0, 0);            // reserved
header.writeUInt16LE(1, 2);            // 1 = icon
header.writeUInt16LE(SIZES.length, 4); // image count

// Each directory entry is 16 bytes and points at image data stored after them.
let offset = 6 + 16 * SIZES.length;
const entries = pngs.map((png, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(SIZES[i], 0);      // width  (0 would mean 256)
  e.writeUInt8(SIZES[i], 1);      // height
  e.writeUInt8(0, 2);             // palette colours
  e.writeUInt8(0, 3);             // reserved
  e.writeUInt16LE(1, 4);          // colour planes
  e.writeUInt16LE(32, 6);         // bits per pixel
  e.writeUInt32LE(png.length, 8); // size of image data
  e.writeUInt32LE(offset, 12);    // offset of image data
  offset += png.length;
  return e;
});

const ico = Buffer.concat([header, ...entries, ...pngs]);
writeFileSync('public/favicon.ico', ico);
console.log(`wrote public/favicon.ico ${ico.length} bytes, sizes ${SIZES.join('/')}`);
console.log('magic:', ico.subarray(0, 4).toString('hex'), '(00000100 = valid ICO)');
