import { useState } from 'react';
import { ButtonBase, Stack, TextField } from '@mui/material';
import SendIcon from '@mui/icons-material/SendRounded';
import { ka } from '@/i18n/ka';

const MAX = 500;

interface ComposerProps {
  sending: boolean;
  onTyping: (isTyping: boolean) => void;
  /** `giveBack` restores the draft if the send fails, rather than losing it. */
  onSend: (body: string, giveBack: () => void) => void;
}

/**
 * The input row, with the draft as its own state.
 *
 * That is the point of it being a separate component. With the draft in
 * ChatPage, every keystroke re-rendered the whole room — two hundred bubbles —
 * and on a phone that was the lag you could feel while typing. Here a
 * keystroke re-renders this row and nothing else.
 */
export function Composer({ sending, onTyping, onSend }: ComposerProps) {
  const [draft, setDraft] = useState('');

  const submit = () => {
    const body = draft.trim();
    if (!body || sending) return;
    setDraft('');
    onTyping(false);
    onSend(body, () => setDraft(body));
  };

  return (
    <Stack
      direction="row"
      spacing={1}
      alignItems="flex-end"
      sx={{
        p: 1.5,
        pb: 'calc(12px + env(safe-area-inset-bottom))',
        borderTop: '1px solid',
        borderColor: 'hairline',
        bgcolor: 'background.paper',
      }}
    >
      <TextField
        fullWidth
        multiline
        maxRows={4}
        size="small"
        value={draft}
        placeholder={ka.chat.placeholder}
        inputProps={{ maxLength: MAX }}
        onChange={(e) => {
          setDraft(e.target.value);
          onTyping(e.target.value.trim().length > 0);
        }}
        onKeyDown={(e) => {
          // Enter sends, Shift+Enter breaks the line — but only with a
          // keyboard. On a phone Enter must insert a newline, or the
          // on-screen return key becomes a send button nobody asked for.
          if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) {
            e.preventDefault();
            submit();
          }
        }}
        sx={{ '& .MuiOutlinedInput-root': { borderRadius: '20px' } }}
      />
      <ButtonBase
        onClick={submit}
        disabled={draft.trim().length === 0 || sending}
        aria-label={ka.chat.send}
        sx={{
          width: 44,
          height: 44,
          flex: 'none',
          borderRadius: 999,
          bgcolor: draft.trim() ? 'primary.main' : 'surface2',
          color: draft.trim() ? 'primary.contrastText' : 'text.disabled',
          transition: 'background-color .16s linear',
        }}
      >
        <SendIcon fontSize="small" />
      </ButtonBase>
    </Stack>
  );
}
