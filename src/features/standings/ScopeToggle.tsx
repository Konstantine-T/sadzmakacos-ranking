import { Box, ButtonBase } from '@mui/material';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

interface ScopeToggleProps<T extends string> {
  value: T;
  segments: readonly Segment<T>[];
  ariaLabel: string;
  onChange: (value: T) => void;
}

/**
 * The one place the board's scope is chosen: this week, or every closed week
 * ever. It replaces the old /all-time page — having a second screen showing the
 * same twenty people in the same order was a navigation dead-end, and the two
 * numbers are only interesting next to each other.
 */
export function ScopeToggle<T extends string>({
  value,
  segments,
  ariaLabel,
  onChange,
}: ScopeToggleProps<T>) {
  return (
    <Box
      role="group"
      aria-label={ariaLabel}
      sx={{
        display: 'flex',
        gap: '4px',
        p: '3px',
        borderRadius: 999,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'surface2',
      }}
    >
      {segments.map((segment) => {
        const active = segment.value === value;
        return (
          <ButtonBase
            key={segment.value}
            aria-pressed={active}
            onClick={() => onChange(segment.value)}
            sx={{
              flex: 1,
              height: 40,
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              bgcolor: active ? 'primary.main' : 'transparent',
              color: active ? 'primary.contrastText' : 'text.secondary',
              transition: 'background-color .16s linear, color .16s linear',
            }}
          >
            {segment.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
