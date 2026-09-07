/**
 * Generate the app icons from public/favicon.svg.
 *
 *   npm run icons
 *
 * Three shapes, because platforms crop differently:
 *
 *   icon-192 / icon-512   the plain marks, rounded corners kept, used by the
 *                         manifest and anywhere the launcher draws them as-is.
 *   icon-maskable-512     full-bleed background with the mark shrunk into the
 *                         middle. Android crops icons to whatever shape the
 *                         launcher likes — circle, squircle, teardrop — and an
 *                         icon that already has its own rounded corners gets
 *                         those corners sliced off. The safe zone is the middle
 *                         80%, so the mark sits at 66%.
 *   apple-touch-icon      180px, square and full-bleed: iOS rounds it itself,
 *                         and a transparent or pre-rounded icon comes out with
 *                         black corners on the Home Screen.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import sharp from 'sharp';

const SRC = 'public/favicon.svg';
const OUT = 'public';
const BG = '#14100F';

const svg = readFileSync(SRC, 'utf8');
// Everything after the background rect — the ember A and the two bars.
const marks = svg.slice(svg.indexOf('</rect>') + 7, svg.lastIndexOf('</svg>')).trim()
  || svg.replace(/<rect width="64"[^>]*\/>/, '').replace(/<\/?svg[^>]*>/g, '').trim();

const square = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<rect width="64" height="64" fill="${BG}"/>${inner}</svg>`;

const rounded = svg; // as authored, corners and all

// 66% of the canvas keeps the mark inside Android's 80% safe circle.
const maskable = square(
  `<g transform="translate(32,32) scale(0.66) translate(-32,-32)">${marks}</g>`,
);

mkdirSync(OUT, { recursive: true });

const jobs = [
  ['icon-192.png', rounded, 192],
  ['icon-512.png', rounded, 512],
  ['icon-maskable-512.png', maskable, 512],
  ['apple-touch-icon.png', square(marks), 180],
];

for (const [name, source, size] of jobs) {
  await sharp(Buffer.from(source))
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(`${OUT}/${name}`);
  console.log(`  ${name}  ${size}×${size}`);
}
console.log('icons written to public/');
