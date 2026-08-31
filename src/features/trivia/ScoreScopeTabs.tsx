import { Box, ButtonBase, Stack } from '@mui/material';
import type { Segment } from '@/features/standings/ScopeToggle';

interface ScoreScopeTabsProps<T extends string> {
  value: T;
  segments: readonly Segment<T>[];
  ariaLabel: string;
  onChange: (value: T) => void;
}

/**
 * The second level of navigation on /trivia: ეს კვირა / საერთო.
 *
 * Deliberately NOT another ScopeToggle. Two pill controls stacked would read as
 * one broken control — the eye cannot tell which pill governs which. This one
 * is underlined text, so the hierarchy is obvious without a label explaining it.
 */
export function ScoreScopeTabs<T extends string>({
  value,
  segments,
  ariaLabel,
  onChange,
}: ScoreScopeTabsProps<T>) {
  return (
    <Stack
      direction="row"
      role="group"
      aria-label={ariaLabel}
      sx={{ gap: 2.5, borderBottom: '1px solid', borderColor: 'hairline' }}
    >
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <ButtonBase
            key={segment.value}
            aria-pressed={active}
            onClick={() => onChange(segment.value)}
            sx={{
              minHeight: 44,
              px: 0.5,
              fontSize: 13.5,
              fontWeight: 600,
              color: active ? 'text.primary' : 'text.secondary',
              boxShadow: active ? (t) => `inset 0 -2px 0 ${t.palette.primary.main}` : 'none',
              transition: 'color .16s linear',
            }}
          >
            <Box component="span">{segment.label}</Box>
          </ButtonBase>
        );
      })}
    </Stack>
  );
}
