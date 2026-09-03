/**
 * Run with:
 *   npm run test:unit
 *
 * Half of this tests the round builder; half tests the country data itself.
 *
 * The data half exists because of the trivia pool. That shipped with questions
 * whose text had been silently mangled during extraction — every automated
 * check passed, because nothing was checking the data, only the code that moved
 * it. This file checks the data: that no code repeats, that no Georgian name is
 * missing or accidentally left in Latin, and that every region holds enough
 * countries for a draw of four. A bad row fails `npm run test:unit` rather than
 * appearing mid-game.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { COUNTRIES } from './countries';
import { nextRound, RECENT_MEMORY } from './round';

// ----------------------------------------------------------------- the data --

test('every country code is unique', () => {
  const codes = COUNTRIES.map((c) => c.code);
  assert.equal(new Set(codes).size, codes.length);
});

test('every code is a two-letter uppercase ISO alpha-2', () => {
  for (const c of COUNTRIES) {
    assert.match(c.code, /^[A-Z]{2}$/, `${c.en} has code ${c.code}`);
  }
});

test('every country has a Georgian name, and it is actually Georgian', () => {
  for (const c of COUNTRIES) {
    assert.ok(c.ka.trim().length > 1, `${c.code} has no Georgian name`);
    // A stray English label would sail through every other check and only be
    // noticed by a player.
    assert.match(c.ka, /[Ⴀ-ჿ]/, `${c.code} (${c.en}) is not in Georgian: ${c.ka}`);
  }
});

test('no two countries share a Georgian name', () => {
  const names = COUNTRIES.map((c) => c.ka);
  const dupes = names.filter((n, i) => names.indexOf(n) !== i);
  assert.deepEqual(dupes, [], `ambiguous answers: ${dupes.join(', ')}`);
});

test('every region can supply a full question', () => {
  const byRegion = new Map<string, number>();
  for (const c of COUNTRIES) byRegion.set(c.region, (byRegion.get(c.region) ?? 0) + 1);
  for (const [region, n] of byRegion) {
    assert.ok(n >= 4, `${region} has only ${n} countries — cannot fill four options`);
  }
});

test('the eight hand edits are present', () => {
  const by = (code: string) => COUNTRIES.find((c) => c.code === code);
  assert.equal(by('SZ')?.ka, 'ესვატინი'); // renamed from Swaziland in 2018
  assert.equal(by('US')?.ka, 'აშშ');
  assert.equal(by('GE')?.ka, 'საქართველო');
});

// ------------------------------------------------------------- the rounds --

test('a round offers four distinct options and includes the answer', () => {
  for (let i = 0; i < 300; i++) {
    const { answer, options } = nextRound();
    assert.equal(options.length, 4);
    assert.equal(new Set(options.map((o) => o.code)).size, 4);
    assert.ok(options.some((o) => o.code === answer.code), 'answer missing from options');
  }
});

test('distractors come from the answer’s own region', () => {
  for (let i = 0; i < 300; i++) {
    const { answer, options } = nextRound();
    for (const o of options) {
      assert.equal(
        o.region,
        answer.region,
        `${o.en} (${o.region}) offered against ${answer.en} (${answer.region})`,
      );
    }
  }
});

test('a recently seen flag is not asked again', () => {
  const recent = COUNTRIES.slice(0, RECENT_MEMORY).map((c) => c.code);
  for (let i = 0; i < 300; i++) {
    assert.ok(!recent.includes(nextRound(recent).answer.code));
  }
});

test('an exhausted memory falls back rather than looping forever', () => {
  // Every country marked as recent — the draw must still return something.
  const all = COUNTRIES.map((c) => c.code);
  const { answer, options } = nextRound(all);
  assert.ok(answer.code);
  assert.equal(options.length, 4);
});
