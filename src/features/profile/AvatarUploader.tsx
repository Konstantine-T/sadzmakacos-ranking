import { useRef, useState } from 'react';
import { Avatar, Badge, Box, CircularProgress, IconButton } from '@mui/material';
import CameraIcon from '@mui/icons-material/PhotoCameraRounded';
import imageCompression from 'browser-image-compression';
import { AVATAR_BUCKET, avatarUrl, supabase } from '@/lib/supabase';
import { avatarProps } from '@/lib/avatar';
import {
  AVATAR_SIZE,
  MAX_UPLOAD_BYTES,
  UNDECODABLE,
  centreSquare,
  checkInput,
  objectPath,
  outputFormat,
  uploadErrorKey,
} from '@/lib/avatarImage';
import { ka } from '@/i18n/ka';

interface AvatarUploaderProps {
  memberId: string;
  nickname: string;
  currentPath: string | null;
  onUploaded: (path: string) => void;
  onError: (message: string) => void;
}

/**
 * Does this browser's canvas actually encode WebP?
 *
 * `toDataURL` returns a PNG data URL when the requested type is unsupported,
 * so the prefix is the answer. Cached: the result cannot change mid-session.
 */
let webpEncoder: boolean | undefined;
function canEncodeWebp(): boolean {
  if (webpEncoder === undefined) {
    const probe = document.createElement('canvas');
    probe.width = 1;
    probe.height = 1;
    webpEncoder = probe.toDataURL('image/webp').startsWith('data:image/webp');
  }
  return webpEncoder;
}

/**
 * A picked file becomes a 512×512 square, small enough that the twenty-row
 * board stays fast on mobile data (§6).
 *
 * The order here is not incidental — it is the fix for four separate ways this
 * used to fail on somebody's phone but not on yours:
 *
 *  1. `imageCompression()` first, NOT a hand-rolled `createImageBitmap`. The
 *     library deliberately refuses to call `createImageBitmap` on iOS and
 *     Safari (it throws "Skip createImageBitmap on IOS and Safari" internally
 *     and falls back to an `<img>`), and it keeps the intermediate canvas under
 *     the browser's maximum area — a 48MP photo drawn at full resolution
 *     silently produces a blank canvas on an iPhone. Calling it directly, as
 *     this file used to, walked into both.
 *  2. `useWebWorker: false`. In worker mode the library fetches ITSELF from
 *     jsdelivr with `importScripts`, and its worker `error` handler rejects
 *     with no main-thread fallback — so an ad blocker, a DNS filter or one bad
 *     minute on the CDN failed the upload outright. For a 512px avatar the
 *     worker saves nothing worth that dependency.
 *  3. The output type is chosen by asking the encoder, not by assuming. See
 *     `outputFormat`.
 *  4. Nothing is measured against the bucket's 2MB limit until after
 *     compression, because that is when it becomes true.
 */
async function toAvatarFile(file: File): Promise<{ file: File; extension: string }> {
  const format = outputFormat(canEncodeWebp());

  // Decode + orient + downscale on the library's browser-safe path. 1024 keeps
  // enough detail that the centre crop still fills 512 without upscaling.
  // Browser decoders reject with a bare Event, so tag the stage that failed
  // rather than letting it arrive as an unreadable generic error.
  let reduced: File;
  try {
    reduced = await imageCompression(file, {
      maxWidthOrHeight: AVATAR_SIZE * 2,
      maxSizeMB: 1,
      initialQuality: 0.92,
      fileType: format.mime,
      useWebWorker: false,
    });
  } catch (cause) {
    // `lib` is ES2020 here, so no `{ cause }` option — keep the original
    // wording in the message instead, where the console still shows it.
    throw new Error(`${UNDECODABLE}: ${cause instanceof Error ? cause.message : String(cause)}`);
  }

  const [, source] = await imageCompression.drawFileInCanvas(reduced);
  const { sx, sy, side } = centreSquare(source.width, source.height);

  const square = document.createElement('canvas');
  square.width = AVATAR_SIZE;
  square.height = AVATAR_SIZE;
  const ctx = square.getContext('2d');
  // No 2D context at all: ship the reduced original, which is already the right
  // type and well under the bucket limit — just not cropped square.
  if (!ctx) return { file: reduced, extension: format.extension };
  ctx.drawImage(source, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

  const squared = await imageCompression.canvasToFile(
    square,
    format.mime,
    `avatar.${format.extension}`,
    Date.now(),
    format.quality,
  );

  // A 512px square lands around 40KB, so this is a backstop rather than a step:
  // it only runs if some pathological image encodes past what storage accepts.
  if (squared.size > MAX_UPLOAD_BYTES) {
    const squeezed = await imageCompression(squared, {
      maxWidthOrHeight: AVATAR_SIZE,
      maxSizeMB: 0.3,
      fileType: format.mime,
      useWebWorker: false,
    });
    return { file: squeezed, extension: format.extension };
  }

  return { file: squared, extension: format.extension };
}

/**
 * The storage path is `{member_id}/{timestamp}.{ext}`; the write policy keys off
 * that first folder segment, so you can only ever write into your own folder.
 */
export function AvatarUploader({
  memberId,
  nickname,
  currentPath,
  onUploaded,
  onError,
}: AvatarUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File) => {
    const rejected = checkInput(file);
    if (rejected) {
      onError(rejected === 'inputTooBig' ? ka.errors.avatarTooBig : ka.errors.avatarWrongType);
      return;
    }

    setBusy(true);
    try {
      const avatar = await toAvatarFile(file);
      const path = objectPath(memberId, avatar.extension, Date.now());

      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, avatar.file, { upsert: true, contentType: avatar.file.type });
      if (error) throw error;

      onUploaded(path);
    } catch (error) {
      // Every failure used to read "რაღაც ვერ გამოვიდა", which is why nobody
      // could say what was wrong with their phone.
      onError(ka.errors[uploadErrorKey(error)]);
    } finally {
      setBusy(false);
    }
  };

  const props = avatarProps(memberId, nickname, avatarUrl(currentPath));

  return (
    <Box>
      {/*
        `image/*` rather than a three-type list: an iPhone converts HEIC to JPEG
        on its way out of the picker, but several Android pickers show an empty
        folder when the accept list names types they don't recognise. Whether
        the bytes decode is decided by the decoder, not by this attribute.
      */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void handleFile(file);
        }}
      />

      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        badgeContent={
          <IconButton
            size="small"
            aria-label={ka.profile.changeAvatar}
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            sx={{
              bgcolor: 'primary.main',
              color: '#fff',
              width: 34,
              height: 34,
              minWidth: 34,
              minHeight: 34,
              '&:hover': { bgcolor: 'primary.dark' },
            }}
          >
            {busy ? <CircularProgress size={16} color="inherit" /> : <CameraIcon fontSize="small" />}
          </IconButton>
        }
      >
        <Avatar {...props} sx={{ ...props.sx, width: 88, height: 88, fontSize: '2rem' }} />
      </Badge>
    </Box>
  );
}
