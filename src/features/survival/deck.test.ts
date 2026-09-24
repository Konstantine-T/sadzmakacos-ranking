/**
 * Run with:
 *   npm run test:unit
 *
 * The survival game's decisions: where the difficulty ramp turns, what a card
 * is built from, which questions cannot be asked, and that nothing is asked
 * twice in one run.
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

// ------------------------------------------------------------------ the card --

test('a card offers the answer and every wrong option, once each', () => {
  const card = toCard(question());
  assert.equal(card.answer, 'Eustachian tube');
  assert.deepEqual(
    [...card.options].sort(),
    ['Eustachian tube', 'Maxillary bulb', 'Optic nerve', 'Philtrum'],
  );
});

test('the answer does not always sit in the same place', () => {
  // The API lists the right answer apart from the wrong ones. Unshuffled, it
  // would be the first button every time.
  const positions = new Set<number>();
  for (let i = 0; i < 200; i++) {
    const card = toCard(question());
    positions.add(card.options.indexOf(card.answer));
  }
  assert.equal(positions.size, 4);
});

test('options are trimmed, so the answer still matches its button', () => {
  const card = toCard(question({ correctAnswer: ' Eustachian tube ' }));
  assert.ok(card.options.includes(card.answer));
});

// ---------------------------------------------------------------- the filter --

test('image and free-text questions are dropped', () => {
  assert.equal(usable(question({ type: 'image_choice' })), false);
  assert.equal(usable(question({ type: 'text_input' })), false);
});

test('a question with no wrong answers is dropped', () => {
  assert.equal(usable(question({ incorrectAnswers: [] })), false);
});

test('a question whose options repeat is dropped, whatever the case', () => {
  assert.equal(usable(question({ incorrectAnswers: ['eustachian tube', 'Philtrum'] })), false);
});

test('"NOT" questions are fine with four options on screen', () => {
  assert.equal(usable(question({ question: { text: 'Which of these is NOT a planet?' } })), true);
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
