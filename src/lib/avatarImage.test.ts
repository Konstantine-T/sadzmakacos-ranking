/**
 * Run with:
 *   npm run test:unit
 *
 * These are the avatar-upload decisions that do not need a browser. The rest of
 * the pipeline (decode, crop, encode) is DOM work and is covered by the manual
 * checklist in the PR — but the gate below is what actually broke, and it is
 * pure, so it gets pinned down here.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AVATAR_SIZE,
  MAX_INPUT_BYTES,
  MAX_UPLOAD_BYTES,
  centreSquare,
  checkInput,
  UNDECODABLE,
  objectPath,
  outputFormat,
  uploadErrorKey,
} from './avatarImage';

const MB = 1024 * 1024;

test('a full-resolution phone photo is accepted', () => {
  // THE BUG. The uploader tested the ORIGINAL file against the bucket's 2MB
  // limit and rejected it before compression ever ran — while its own comment
  // promised "a 6MB phone photo becomes ~40KB". Everyone who picked a real
  // camera photo was told the picture was too big; everyone who picked a
  // screenshot or a photo forwarded through WhatsApp (already recompressed,
  // well under 2MB) got through. That is the whole "works for some of them".
  assert.equal(checkInput({ type: 'image/jpeg', size: 6 * MB }), null);
  assert.equal(checkInput({ type: 'image/heic', size: 12 * MB }), null);
});

test('an absurd file is still refused, but far above any photo', () => {
  assert.equal(checkInput({ type: 'image/jpeg', size: MAX_INPUT_BYTES + 1 }), 'inputTooBig');
  assert.ok(MAX_INPUT_BYTES > 8 * MB, 'must clear a 48MP phone photo');
});

test('a non-image is refused, an unlabelled file is not', () => {
  assert.equal(checkInput({ type: 'video/mp4', size: MB }), 'notAnImage');
  assert.equal(checkInput({ type: 'application/pdf', size: 1024 }), 'notAnImage');
  // Some Android pickers hand back an empty type for a perfectly good JPEG.
  assert.equal(checkInput({ type: '', size: MB }), null);
});

test('the crop takes the centre of the short side', () => {
  assert.deepEqual(centreSquare(4032, 3024), { sx: 504, sy: 0, side: 3024 }); // landscape
  assert.deepEqual(centreSquare(3024, 4032), { sx: 0, sy: 504, side: 3024 }); // portrait
  assert.deepEqual(centreSquare(800, 800), { sx: 0, sy: 0, side: 800 }); // already square
});

test('WebP where it encodes, JPEG where it does not — never PNG', () => {
  assert.equal(outputFormat(true).mime, 'image/webp');
  assert.equal(outputFormat(true).extension, 'webp');

  const fallback = outputFormat(false);
  assert.equal(fallback.mime, 'image/jpeg');
  assert.equal(fallback.extension, 'jpg');
  // A 512×512 photographic PNG runs ~400KB against WebP's ~40KB. Falling back
  // to PNG is what canvas.toBlob does on its own, and it is the wrong answer.
  assert.notEqual(fallback.mime, 'image/png');
});

test('the object path leads with the member id, which is what the policy keys on', () => {
  const id = '3f7c1e2a-0000-4000-8000-000000000001';
  assert.equal(objectPath(id, 'webp', 1_700_000_000_000), `${id}/1700000000000.webp`);
  assert.equal(objectPath(id, 'jpg', 1).split('/')[0], id);
});

test('storage failures are told apart', () => {
  assert.equal(uploadErrorKey({ statusCode: '413', message: 'Payload too large' }), 'avatarTooBig');
  assert.equal(uploadErrorKey(new Error('mime type image/heic is not supported')), 'avatarWrongType');
  assert.equal(
    uploadErrorKey(new Error('The source image could not be decoded')),
    'avatarUndecodable',
  );
  // What the pipeline throws when a browser decoder gives up. It rejects with a
  // bare Event, so without the tag this arrived as 'generic' — the exact
  // flattening that made the original reports impossible to act on.
  assert.equal(uploadErrorKey(new Error(UNDECODABLE)), 'avatarUndecodable');
  assert.equal(uploadErrorKey(new Event('error')), 'generic');
  assert.equal(
    uploadErrorKey(new Error('new row violates row-level security policy')),
    'forbidden',
  );
  assert.equal(uploadErrorKey(new TypeError('Failed to fetch')), 'offline');
  // Safari's wording for a dropped connection.
  assert.equal(uploadErrorKey(new TypeError('Load failed')), 'offline');
  assert.equal(uploadErrorKey(new Error('something else entirely')), 'generic');
});

test('the compressed file has to clear the bucket, not the input', () => {
  assert.equal(MAX_UPLOAD_BYTES, 2 * MB); // migration 08's file_size_limit
  assert.ok(MAX_INPUT_BYTES > MAX_UPLOAD_BYTES);
  assert.equal(AVATAR_SIZE, 512);
});
