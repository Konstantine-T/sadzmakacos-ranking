/**
 * Copy the flag SVGs we actually use into public/flags/.
 *
 *   npm run flags:sync
 *
 * SOURCE: flag-icons, NOT country-flag-icons. The first attempt used the
 * latter, whose flags are deliberately simplified to stay tiny — which is fine
 * for a country picker and fatal for a flag quiz. Its Mexico was 631 bytes: a
 * green-white-red tricolour with a coloured smudge where the eagle belongs.
 * Portugal had no armillary sphere and Spain no coat of arms at all. Accurate
 * emblems are the entire game, so size loses to correctness here.
 *
 * They live in public/ rather than being imported. A question shows ONE flag,
 * so a player downloads the ~0.7KB median rather than the 1.2MB set; bundling
 * would make everyone pay for all 195 up front. Serving them ourselves also
 * means the game does not depend on a third-party CDN staying free and
 * reachable — a flag round where the flag does not load is worse than no game.
 *
 * flag-icons is a devDependency: it is only the source these are copied from,
 * and nothing imports it at runtime.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const SRC = 'node_modules/flag-icons/flags/4x3';
const OUT = 'public/flags';

const codes = [
  ...readFileSync('src/features/flags/countries.ts', 'utf8').matchAll(/code: '([A-Z]{2})'/g),
].map((m) => m[1]);

if (codes.length === 0) throw new Error('no country codes found — did countries.ts change shape?');

mkdirSync(OUT, { recursive: true });
let bytes = 0;
for (const code of codes) {
  // flag-icons names its files in lowercase; we serve them uppercase to
  // match the ISO codes in countries.ts.
  const from = `${SRC}/${code.toLowerCase()}.svg`;
  if (!existsSync(from)) throw new Error(`no flag asset for ${code}`);
  const svg = readFileSync(from);
  bytes += svg.length;
  writeFileSync(`${OUT}/${code}.svg`, svg);
}
console.log(`synced ${codes.length} flags to ${OUT} — ${(bytes / 1024).toFixed(0)} KB`);
