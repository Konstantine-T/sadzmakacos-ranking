/**
 * The decisions behind an avatar upload, kept apart from the DOM work so they
 * can be tested without a browser (`src/lib/avatarImage.test.ts`).
 *
 * Nothing here touches canvas, storage or React — see
 * `src/features/profile/AvatarUploader.tsx` for the pipeline that uses it.
 */

/** Every avatar is stored as a square of this side (§6). */
export const AVATAR_SIZE = 512;

/**
 * The bucket's own `file_size_limit` (migration 08). Storage rejects anything
 * larger with a 413, so this is the ceiling the *compressed* file must clear —
 * never a limit on what the member is allowed to pick.
 */
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;

/**
 * What we will even attempt to decode. A 512×512 square comes out at ~40KB
 * whatever goes in, so this exists only to fail fast on something absurd (a
 * video renamed .jpg, a 200MP panorama that would blow the canvas limit)
 * rather than to police photo quality. A 48MP phone photo is ~12MB.
 */
export const MAX_INPUT_BYTES = 32 * 1024 * 1024;

export type AvatarReject = 'notAnImage' | 'inputTooBig';

/**
 * Whether we are willing to try this file at all.
 *
 * Deliberately permissive about type: phone pickers hand back `image/heic`,
 * `image/heif`, and sometimes an empty string for a file they cannot label.
 * Whether the bytes actually decode is not knowable here — that is the
 * decoder's answer, and it gets its own error path.
 */
export function checkInput(file: { type: string; size: number }): AvatarReject | null {
  if (file.size > MAX_INPUT_BYTES) return 'inputTooBig';
  if (file.type !== '' && !file.type.startsWith('image/')) return 'notAnImage';
  return null;
}

/**
 * The centre square of a w×h image, in source pixels.
 *
 * Crop before scaling, never after: taking the short side keeps the middle of
 * a portrait photo (where the face is) instead of squashing the whole frame
 * into a square.
 */
export function centreSquare(width: number, height: number) {
  const side = Math.min(width, height);
  return { sx: (width - side) / 2, sy: (height - side) / 2, side };
}

export interface OutputFormat {
  mime: string;
  extension: string;
  /** WebP is lossy-tuned; JPEG needs a touch more to avoid visible blocking. */
  quality: number;
}

/**
 * WebP where it encodes, JPEG where it doesn't.
 *
 * `canvas.toBlob(cb, 'image/webp')` does not fail on a browser without a WebP
 * encoder — the HTML spec says to fall back to `image/png` — so it silently
 * returns PNG bytes. Safari only learned to encode WebP in 16.4, which is why
 * an older iPhone used to upload a PNG labelled `image/webp`. Ask first, and
 * fall back to JPEG rather than PNG: a 512×512 photographic PNG is an order of
 * magnitude larger and is what pushed some uploads over the bucket's limit.
 *
 * Both types are in the bucket's `allowed_mime_types` (migration 08).
 */
export function outputFormat(canEncodeWebp: boolean): OutputFormat {
  return canEncodeWebp
    ? { mime: 'image/webp', extension: 'webp', quality: 0.88 }
    : { mime: 'image/jpeg', extension: 'jpg', quality: 0.92 };
}

/**
 * `{member_id}/{timestamp}.{ext}`.
 *
 * The first folder segment is what the storage write policies key on, so the
 * member id has to lead. A fresh timestamp per upload rather than a `?v=`
 * query string sidesteps CDN caching entirely.
 */
export function objectPath(memberId: string, extension: string, now: number): string {
  return `${memberId}/${now}.${extension}`;
}

/**
 * Marker for "no decoder in this browser would open that file" — a HEIC picked
 * through an Android file browser, a RAW, a truncated download.
 */
export const UNDECODABLE = 'avatar_undecodable';

export type UploadErrorKey =
  | 'avatarTooBig'
  | 'avatarUndecodable'
  | 'avatarWrongType'
  | 'forbidden'
  | 'offline'
  | 'generic';

/**
 * Why the upload failed, in terms the member can act on.
 *
 * Every failure used to arrive as the same "რაღაც ვერ გამოვიდა", which is
 * exactly why this took so long to find: a 413 from storage, an undecodable
 * HEIC and an RLS refusal were indistinguishable from the outside.
 */
export function uploadErrorKey(error: unknown): UploadErrorKey {
  const status =
    typeof error === 'object' && error !== null && 'statusCode' in error
      ? Number((error as { statusCode: unknown }).statusCode)
      : undefined;

  const message = (
    error instanceof Error ? error.message : String(error ?? '')
  ).toLowerCase();

  if (status === 413 || message.includes('payload too large') || message.includes('exceeded the maximum allowed size')) {
    return 'avatarTooBig';
  }
  if (message.includes('mime type') || message.includes('invalid_mime_type')) return 'avatarWrongType';
  // `UNDECODABLE` is thrown by the pipeline itself: the browser decoders reject
  // with a bare `Event` or an untyped DOMException, which carries nothing worth
  // matching on, so the decode stage tags its own failure.
  if (
    message.includes(UNDECODABLE) ||
    message.includes('could not be decoded') ||
    message.includes('source image')
  ) {
    return 'avatarUndecodable';
  }
  if (status === 403 || message.includes('row-level security') || message.includes('unauthorized')) {
    return 'forbidden';
  }
  if (message.includes('failed to fetch') || message.includes('networkerror') || message.includes('load failed')) {
    return 'offline';
  }
  return 'generic';
}
