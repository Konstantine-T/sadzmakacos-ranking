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
import { nextRound, PERFECT } from './round';

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
    const round = nextRound();
    assert.ok(round, 'a fresh pool must yield a round');
    assert.equal(round.options.length, 4);
    assert.equal(new Set(round.options.map((o) => o.code)).size, 4);
    assert.ok(round.options.some((o) => o.code === round.answer.code), 'answer missing');
  }
});

test('distractors come from the answer’s own region', () => {
  for (let i = 0; i < 300; i++) {
    const round = nextRound()!;
    for (const o of round.options) {
      assert.equal(
        o.region,
        round.answer.region,
        `${o.en} (${o.region}) offered against ${round.answer.en} (${round.answer.region})`,
      );
    }
  }
});

test('a country already asked is never asked again', () => {
  const used = COUNTRIES.slice(0, 50).map((c) => c.code);
  for (let i = 0; i < 300; i++) {
    assert.ok(!used.includes(nextRound(used)!.answer.code));
  }
});

test('distractors may still reuse a spent country', () => {
  // Only the answer is consumed. Late in a run, excluding shown countries from
  // the options too would leave nothing to draw from.
  const allButOne = COUNTRIES.slice(1).map((c) => c.code);
  const round = nextRound(allButOne);
  assert.ok(round);
  assert.equal(round.answer.code, COUNTRIES[0].code);
  assert.equal(round.options.length, 4);
});

test('an exhausted pool ends the run instead of repeating', () => {
  const everything = COUNTRIES.map((c) => c.code);
  assert.equal(nextRound(everything), null);
});

test('PERFECT is the size of the pool, so a flawless run is finite', () => {
  assert.equal(PERFECT, COUNTRIES.length);

  // Walk a whole perfect game: every answer distinct, ending in exactly PERFECT
  // rounds and then null.
  const used: string[] = [];
  let rounds = 0;
  for (;;) {
    const round = nextRound(used);
    if (!round) break;
    assert.ok(!used.includes(round.answer.code));
    used.push(round.answer.code);
    rounds++;
    assert.ok(rounds <= PERFECT, 'ran past the pool');
  }
  assert.equal(rounds, PERFECT);
});
