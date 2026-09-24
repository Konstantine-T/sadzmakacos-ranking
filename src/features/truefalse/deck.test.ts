/**
 * Run with:
 *   npm run test:unit
 *
 * The true/false game's decisions: where the difficulty ramp turns, what a coin
 * flip does to a question, which questions cannot be asked as a yes/no claim,
 * and that nothing is asked twice in one run.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { freshCards, tierFor, toCard, usable, type ApiQuestion } from './deck';

function question(overrides: Partial<ApiQuestion> = {}): ApiQuestion {
  return {
    id: 'q1',
    category: 'science',
    difficulty: 'easy',
    type: 'text_choice',
    question: { text: 'What connects the nose to the ear?' },
    correctAnswer: 'Eustachian tube',
    incorrectAnswers: ['Philtrum', 'Maxillary bulb', 'Optic nerve'],
    ...overrides,
  };
}

/** A `random` that returns the given values in order. */
function sequence(...values: number[]) {
  let i = 0;
  return () => values[i++ % values.length];
}

// ------------------------------------------------------------------ the ramp --

test('the first ten cards are easy', () => {
  assert.equal(tierFor(0), 'easy');
  assert.equal(tierFor(9), 'easy');
});

test('cards eleven to twenty are medium', () => {
  assert.equal(tierFor(10), 'medium');
  assert.equal(tierFor(19), 'medium');
});

test('everything after twenty is hard, forever', () => {
  assert.equal(tierFor(20), 'hard');
  assert.equal(tierFor(500), 'hard');
});

// ------------------------------------------------------------- the coin flip --

test('heads proposes the right answer, and the card is true', () => {
  const card = toCard(question(), sequence(0.1, 0));
  assert.equal(card.truth, true);
  assert.equal(card.shown, 'Eustachian tube');
});

test('tails proposes a wrong answer, and the card is false', () => {
  const card = toCard(question(), sequence(0.9, 0.5));
  assert.equal(card.truth, false);
  assert.equal(card.shown, 'Maxillary bulb');
  assert.equal(card.correctAnswer, 'Eustachian tube', 'a miss must still be able to name it');
});

test('a false card never proposes the right answer', () => {
  for (let r = 0; r < 1; r += 0.05) {
    const card = toCard(question(), sequence(0.9, r));
    assert.notEqual(card.shown, card.correctAnswer);
  }
});

// ------------------------------------------------------------------ the filter --

test('a question with "not" in it is dropped, in any case', () => {
  assert.equal(usable(question({ question: { text: 'Which of these is NOT a planet?' } })), false);
  assert.equal(usable(question({ question: { text: 'Which is not a mammal?' } })), false);
});

test('"not" inside another word does not drop a question', () => {
  assert.equal(usable(question({ question: { text: 'Which note is middle C?' } })), true);
  assert.equal(usable(question({ question: { text: 'Who wrote Nothing Compares 2 U?' } })), true);
});

test('image and free-text questions are dropped', () => {
  assert.equal(usable(question({ type: 'image_choice' })), false);
  assert.equal(usable(question({ type: 'text_input' })), false);
});

test('a question with no wrong answers is dropped', () => {
  assert.equal(usable(question({ incorrectAnswers: [] })), false);
});

// ---------------------------------------------------------------- the dedupe --

test('a question already seen this run is not dealt again', () => {
  const cards = freshCards([question({ id: 'a' }), question({ id: 'b' })], new Set(['a']));
  assert.deepEqual(
    cards.map((c) => c.id),
    ['b'],
  );
});

test('a question repeated inside one batch is dealt once', () => {
  const cards = freshCards([question({ id: 'a' }), question({ id: 'a' })], new Set());
  assert.equal(cards.length, 1);
});

test('freshCards does not mutate the seen set it was given', () => {
  const seen = new Set<string>();
  freshCards([question({ id: 'a' })], seen);
  assert.equal(seen.size, 0);
});
