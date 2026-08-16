import { useRef, useState } from 'react';
import { Avatar, Badge, Box, CircularProgress, IconButton } from '@mui/material';
import CameraIcon from '@mui/icons-material/PhotoCameraRounded';
import imageCompression from 'browser-image-compression';
import { AVATAR_BUCKET, avatarUrl, supabase } from '@/lib/supabase';
import { avatarProps } from '@/lib/avatar';
import { ka } from '@/i18n/ka';

const MAX_BYTES = 2 * 1024 * 1024; // 2MB before compression
const SIZE = 512;

interface AvatarUploaderProps {
  memberId: string;
  nickname: string;
  currentPath: string | null;
  onUploaded: (path: string) => void;
  onError: (error: unknown) => void;
}

/** Crops to a 512×512 square from the centre, then hands it to WebP encoding. */
async function toSquare(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - side) / 2;
  const sy = (bitmap.height - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, SIZE, SIZE);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/webp', 0.88),
  );
  if (!blob) return file;
  return new File([blob], 'avatar.webp', { type: 'image/webp' });
}

/**
 * Resize/crop to a 512×512 WebP square before upload (§6), so a 6MB phone
 * photo becomes ~40KB and the twenty-row board stays fast on mobile data.
 *
 * The storage path is `{member_id}/avatar.webp`; the write policy keys off that
 * first folder segment, so you can only ever overwrite your own.
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
    if (file.size > MAX_BYTES) {
      onError(new Error(ka.errors.avatarTooBig));
      return;
    }

    setBusy(true);
    try {
      const square = await toSquare(file);
      const compressed = await imageCompression(square, {
        maxWidthOrHeight: SIZE,
        maxSizeMB: 0.3,
        fileType: 'image/webp',
        useWebWorker: true,
      });

      // A fresh filename per upload rather than a `?v=` query string: the
      // storage policy keys on the first folder segment either way, but a new
      // path sidesteps CDN caching entirely instead of relying on getPublicUrl
      // passing a query string through untouched.
      const path = `${memberId}/${Date.now()}.webp`;
      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, compressed, { upsert: true, contentType: 'image/webp' });
      if (error) throw error;

      onUploaded(path);
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const props = avatarProps(memberId, nickname, avatarUrl(currentPath));

  return (
    <Box>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
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
