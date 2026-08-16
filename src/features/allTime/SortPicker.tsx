import { Box, ButtonBase } from '@mui/material';
import { ka } from '@/i18n/ka';
import type { AllTimeSort } from './api';

const OPTIONS: readonly { value: AllTimeSort; label: string }[] = [
  { value: 'total_net', label: ka.allTime.sortTotal },
  { value: 'avg_net', label: ka.allTime.sortAvg },
  { value: 'weeks_at_one', label: ka.allTime.sortCrowns },
];

/**
 * Three words where the old all-time page had a sortable table header.
 *
 * The board layout has no columns to click, but §1.7 is a real requirement —
 * total and average measure genuinely different things and dropping either one
 * would pick a winner on the group's behalf. So the choice moves into the hint
 * slot beside the list title, where it costs one line.
 */
export function SortPicker({
  value,
  onChange,
}: {
  value: AllTimeSort;
  onChange: (value: AllTimeSort) => void;
}) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
      {OPTIONS.map((option, index) => {
        const active = option.value === value;
        return (
          <Box key={option.value} sx={{ display: 'flex', alignItems: 'center' }}>
            {index > 0 && (
              <Box component="span" sx={{ color: 'textMute', fontSize: 11, px: '2px' }}>
                ·
              </Box>
            )}
            <ButtonBase
              aria-pressed={active}
              onClick={() => onChange(option.value)}
              sx={{
                position: 'relative',
                px: '4px',
                height: 20,
                borderRadius: '4px',
                fontSize: 11.5,
                fontWeight: active ? 700 : 400,
                color: active ? 'signal.up' : 'text.secondary',
                // Invisible 44px hit area (rule 5) over an 11.5px label.
                '&::after': { content: '""', position: 'absolute', inset: '-12px -6px' },
              }}
            >
              {option.label}
            </ButtonBase>
          </Box>
        );
      })}
    </Box>
  );
}
