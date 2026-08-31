/**
 * Run with:
 *   npm run test:unit
 *
 * The trivia ranking rule, pinned down. This is pure logic and it has to agree
 * with trg_week_freeze_trivia() in 20260830000100_trivia.sql — a member reads
 * "#3" on the live board and then sees the frozen week say something else if
 * these two ever drift.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { rankTrivia, type TriviaRankable } from './triviaRanking';

const row = (nickname: string, correct: number, answered: number): TriviaRankable => ({
  member_id: nickname,
  nickname,
  correct,
  answered,
});

test('ties share a rank and the next rank skips past all of them', () => {
  const ranked = rankTrivia([
    row('a', 10, 10),
    row('b', 8, 10),
    row('c', 8, 10),
    row('d', 8, 10),
    row('e', 5, 10),
  ]);

  assert.deepEqual(
    ranked.map((r) => r.rank),
    [1, 2, 2, 2, 5],
  );
});

test('the cleanest sheet sits on top inside a shared rank', () => {
  // Both scored 8. `answered` ascending IS wrong-answers ascending, so the
  // player who got 8 of 8 outranks the one who needed 10 attempts — but they
  // still share the rank number, because only `correct` can move it.
  const ranked = rankTrivia([row('sloppy', 8, 10), row('clean', 8, 8)]);

  assert.equal(ranked[0].nickname, 'clean');
  assert.equal(ranked[1].nickname, 'sloppy');
  assert.deepEqual(
    ranked.map((r) => r.rank),
    [1, 1],
  );
});

test('an unfinished test scores what it earned, not zero', () => {
  const ranked = rankTrivia([row('finished', 5, 10), row('stopped', 6, 6)]);

  assert.equal(ranked[0].nickname, 'stopped');
  assert.equal(ranked[0].rank, 1);
});

test('nickname breaks a total tie, collated for Georgian', () => {
  const ranked = rankTrivia([row('ბექა', 7, 10), row('ანა', 7, 10)]);

  assert.deepEqual(
    ranked.map((r) => r.nickname),
    ['ანა', 'ბექა'],
  );
});

test('an empty board is empty, not a crash', () => {
  assert.deepEqual(rankTrivia([]), []);
});

test('everybody on zero shares rank 1', () => {
  const ranked = rankTrivia([row('a', 0, 0), row('b', 0, 0), row('c', 0, 0)]);

  assert.deepEqual(
    ranked.map((r) => r.rank),
    [1, 1, 1],
  );
});
