import { Avatar, Box, ButtonBase, Paper, Stack, Tooltip, Typography } from '@mui/material';
import CheckIcon from '@mui/icons-material/CheckRounded';
import { avatarProps } from '@/lib/avatar';
import { avatarUrl } from '@/lib/supabase';
import { ka } from '@/i18n/ka';
import type { Member } from '@/lib/database.types';
import type { ActivePoll, PollOptionWithVoters } from './api';

interface PollCardProps {
  poll: ActivePoll;
  members: Map<string, Member>;
  totalMembers: number;
  onAnswer: (optionIds: string[]) => void;
}

/** How many faces fit before the row starts counting instead. */
const FACES = 6;

/**
 * The admin's question, at the top of the board.
 *
 * Two things make this look different from every other vote in the app, on
 * purpose: the row says outright that answers are public, and each option
 * carries the faces of the people who picked it. Rule 1 keeps ranking votes
 * secret, and a poll that quietly broke that expectation would be worse than no
 * poll at all — so the exception is stated rather than implied.
 *
 * Selecting is a full replacement of your answer set, not a per-row toggle, so
 * a single-choice poll switches sides in one tap instead of leaving you briefly
 * with no answer.
 */
export function PollCard({ poll, members, totalMembers, onAnswer }: PollCardProps) {
  const open = poll.closed_at === null;

  const select = (option: PollOptionWithVoters) => {
    if (!open) return;

    if (!poll.is_multi) {
      // Tapping your current answer again clears it, exactly like a vote arrow.
      onAnswer(option.mine ? [] : [option.id]);
      return;
    }

    const chosen = poll.options.filter((o) => o.mine).map((o) => o.id);
    onAnswer(
      option.mine ? chosen.filter((id) => id !== option.id) : [...chosen, option.id],
    );
  };

  return (
    <Paper sx={{ borderRadius: '16px', overflow: 'hidden' }}>
      <Stack spacing={1.5} sx={{ p: 2 }}>
        <Stack spacing={0.75}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography
              sx={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: 'primary.main',
              }}
            >
              {ka.polls.title}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {open ? (poll.is_multi ? ka.polls.pickMany : ka.polls.pickOne) : ka.polls.closed}
            </Typography>
          </Stack>

          <Typography variant="h3" sx={{ fontFamily: (t) => t.typography.h1.fontFamily }}>
            {poll.question}
          </Typography>

          {/* The contract, said out loud — this is the app's only signed vote. */}
          <Typography sx={{ fontSize: 11.5, color: 'textMute' }}>{ka.polls.signed}</Typography>
        </Stack>

        <Stack spacing={0.75}>
          {poll.options.map((option) => {
            const share = poll.max > 0 ? (option.count / poll.max) * 100 : 0;
            const faces = option.voterIds.slice(0, FACES);

            return (
              <ButtonBase
                key={option.id}
                onClick={() => select(option)}
                disabled={!open}
                aria-pressed={option.mine}
                sx={{
                  position: 'relative',
                  width: '100%',
                  minHeight: 44,
                  px: 1.5,
                  py: 1,
                  gap: 1.25,
                  borderRadius: '10px',
                  overflow: 'hidden',
                  justifyContent: 'flex-start',
                  border: '1px solid',
                  borderColor: option.mine ? 'primary.main' : 'divider',
                  cursor: open ? 'pointer' : 'default',
                  '&.Mui-disabled': { opacity: 1 }, // closed polls still read clearly
                }}
              >
                {/* The tally, drawn behind the label rather than beside it, so a
                    long Georgian option never has to fight a bar for width. */}
                <Box
                  aria-hidden
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    width: `${share}%`,
                    bgcolor: option.mine ? 'rgba(247,55,24,0.16)' : 'surface2',
                    transition: 'width .28s cubic-bezier(.2,.8,.2,1)',
                  }}
                />

                <Box
                  sx={{
                    position: 'relative',
                    width: 18,
                    height: 18,
                    flex: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    // Round means "one of these"; square means "as many as you like".
                    borderRadius: poll.is_multi ? '5px' : 99,
                    border: '1px solid',
                    borderColor: option.mine ? 'primary.main' : 'divider',
                    bgcolor: option.mine ? 'primary.main' : 'transparent',
                    color: 'primary.contrastText',
                  }}
                >
                  {option.mine && <CheckIcon sx={{ fontSize: 13 }} />}
                </Box>

                <Typography
                  sx={{
                    position: 'relative',
                    flexGrow: 1,
                    textAlign: 'left',
                    fontSize: 14,
                    fontWeight: option.mine ? 600 : 400,
                    textWrap: 'pretty',
                  }}
                >
                  {option.label}
                </Typography>

                <Stack direction="row" spacing="-6px" sx={{ position: 'relative', flex: 'none' }}>
                  {faces.map((memberId) => {
                    const member = members.get(memberId);
                    const nickname = member?.nickname ?? '—';
                    const ava = avatarProps(
                      memberId,
                      nickname,
                      avatarUrl(member?.avatar_url ?? null),
                    );
                    return (
                      <Tooltip key={memberId} title={nickname}>
                        <Avatar
                          {...ava}
                          sx={{
                            ...ava.sx,
                            width: 20,
                            height: 20,
                            fontSize: '0.5rem',
                            border: '1px solid',
                            borderColor: 'background.paper',
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Stack>

                <Typography
                  sx={{
                    position: 'relative',
                    flex: 'none',
                    minWidth: 16,
                    textAlign: 'right',
                    fontSize: 13,
                    fontWeight: 700,
                    fontVariantNumeric: 'tabular-nums',
                    color: option.count > 0 ? 'signal.up' : 'textMute',
                  }}
                >
                  {option.count}
                </Typography>
              </ButtonBase>
            );
          })}
        </Stack>

        <Typography variant="caption" color="text.secondary">
          {poll.answeredBy === 0
            ? ka.polls.noAnswers
            : ka.polls.answered(poll.answeredBy, totalMembers)}
        </Typography>
      </Stack>
    </Paper>
  );
}
