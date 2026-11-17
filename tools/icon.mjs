// tools/icon.mjs: write app/favicon.ico, the brand mark (two green squares on black) as a 16x16 icon.
//
// A browser asks for /favicon.ico on its own, so the file needs no <link> and is no part of the first load the
// dossier counts; without it every visit logs a 404. The bytes are fixed: the same run writes the same file.
//
//   node tools/icon.mjs
import { writeFileSync } from 'node:fs';

const SIZE = 16;
const GREEN = [0x80, 0xde, 0x4a, 0xff]; // #4ade80 as blue, green, red, alpha
const BLACK = [0x0f, 0x0c, 0x09, 0xff]; // #090c0f

// The mark: a square in the top left and one in the bottom right, each 6 pixels, with a 2 pixel margin.
const lit = (x, y) => (x >= 2 && x < 8 && y >= 2 && y < 8) || (x >= 8 && x < 14 && y >= 8 && y < 14);

const header = Buffer.alloc(6);
header.writeUInt16LE(1, 2); // an icon
header.writeUInt16LE(1, 4); // holding one image

const bitmap = Buffer.alloc(40);
bitmap.writeUInt32LE(40, 0); // BITMAPINFOHEADER
bitmap.writeInt32LE(SIZE, 4);
bitmap.writeInt32LE(SIZE * 2, 8); // the colour rows and the mask rows together
bitmap.writeUInt16LE(1, 12);
bitmap.writeUInt16LE(32, 14);

const pixels = Buffer.alloc(SIZE * SIZE * 4);
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // Bitmap rows run bottom to top.
    pixels.set(lit(x, SIZE - 1 - y) ? GREEN : BLACK, (y * SIZE + x) * 4);
  }
}
const mask = Buffer.alloc(SIZE * 4); // every pixel opaque

const entry = Buffer.alloc(16);
entry.writeUInt8(SIZE, 0);
entry.writeUInt8(SIZE, 1);
entry.writeUInt16LE(1, 4);
entry.writeUInt16LE(32, 6);
entry.writeUInt32LE(bitmap.length + pixels.length + mask.length, 8);
entry.writeUInt32LE(header.length + entry.length, 12);

const icon = Buffer.concat([header, entry, bitmap, pixels, mask]);
writeFileSync('app/favicon.ico', icon);
console.log(`app/favicon.ico  ${icon.length} bytes`);
