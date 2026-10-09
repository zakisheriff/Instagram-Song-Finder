// Renders the PNG icons from app/icon.svg. Run with `npm run icons` after
// changing the mark; the generated files are committed.
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const source = await readFile(new URL("../app/icon.svg", import.meta.url), "utf8");
const markPath = source.match(/<path[^>]*\/>/)?.[0];
const defs = source.match(/<defs>[\s\S]*<\/defs>/)?.[0];
if (!markPath || !defs) throw new Error("Could not read the mark from app/icon.svg");

/** The mark centred on a white square, scaled to leave `padding` (0–0.5) on each side. */
function framed(size, padding) {
  const scale = (size * (1 - padding * 2)) / 60;
  const offset = size * padding;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${defs}
    <rect width="${size}" height="${size}" fill="#ffffff"/>
    <g transform="translate(${offset} ${offset}) scale(${scale})">${markPath}</g>
  </svg>`;
}

const targets = [
  { file: "../public/icons/icon-192.png", size: 192, padding: 0.18 },
  { file: "../public/icons/icon-512.png", size: 512, padding: 0.18 },
  // Maskable icons keep the mark inside the central safe zone.
  { file: "../public/icons/icon-maskable-512.png", size: 512, padding: 0.26 },
  { file: "../app/apple-icon.png", size: 180, padding: 0.2 },
];

for (const { file, size, padding } of targets) {
  const png = await sharp(Buffer.from(framed(size, padding))).png({ compressionLevel: 9 }).toBuffer();
  await writeFile(new URL(file, import.meta.url), png);
  console.log(`${file.replace("../", "")}  ${size}x${size}  ${png.length} bytes`);
}
