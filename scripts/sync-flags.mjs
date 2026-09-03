/**
 * Copy the flag SVGs we actually use into public/flags/.
 *
 *   npm run flags:sync
 *
 * They live in public/ rather than being imported, for two reasons. A question
 * shows one flag, so a player downloads a few hundred bytes rather than the
 * whole 110KB set — bundling them into JS would make everyone pay for all 195
 * up front. And serving them ourselves means the game does not depend on a
 * third-party CDN staying free and reachable; a flag round where the flag does
 * not load is worse than no game at all.
 *
 * country-flag-icons is a devDependency: it is the source these are copied
 * from, and nothing imports it at runtime.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';

const SRC = 'node_modules/country-flag-icons/3x2';
const OUT = 'public/flags';

const codes = [
  ...readFileSync('src/features/flags/countries.ts', 'utf8').matchAll(/code: '([A-Z]{2})'/g),
].map((m) => m[1]);

if (codes.length === 0) throw new Error('no country codes found — did countries.ts change shape?');

mkdirSync(OUT, { recursive: true });
let bytes = 0;
for (const code of codes) {
  const from = `${SRC}/${code}.svg`;
  if (!existsSync(from)) throw new Error(`no flag asset for ${code}`);
  const svg = readFileSync(from);
  bytes += svg.length;
  writeFileSync(`${OUT}/${code}.svg`, svg);
}
console.log(`synced ${codes.length} flags to ${OUT} — ${(bytes / 1024).toFixed(0)} KB`);
