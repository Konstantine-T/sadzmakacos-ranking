import { ember } from '@/theme/tokens';

/**
 * Fallback avatars (§6): the first Georgian letter of the nickname on an
 * ember-tinted background derived from a hash of the member id, so the same
 * person always gets the same colour.
 */

const PALETTE = [ember[500], ember[600], ember[700], ember[400], ember[800], '#B4531F', '#8C4A2F'];

function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function avatarColor(memberId: string): string {
  return PALETTE[hash(memberId) % PALETTE.length];
}

export function avatarInitial(nickname: string): string {
  return [...nickname.trim()][0] ?? '?';
}

/** Everything `<Avatar>` needs for a member, avatar or not. */
export function avatarProps(memberId: string, nickname: string, url: string | null) {
  return {
    src: url ?? undefined,
    children: url ? undefined : avatarInitial(nickname),
    sx: {
      bgcolor: avatarColor(memberId),
      color: '#fff',
      fontWeight: 700,
      fontSize: '0.95rem',
    },
  };
}
