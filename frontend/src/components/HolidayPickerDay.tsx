import { forwardRef } from 'react';
import Tooltip from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
import { PickerDay, type PickerDayProps } from '@mui/x-date-pickers/PickerDay';

// A pseudo-element on the day button itself, not a wrapping element (e.g. Badge) — DayCalendar lays
// out days in a fixed-width flex row, and a wrapper wrecked that sizing, breaking whole rows onto the
// wrong columns. ButtonBase (PickerDay's base) is already position:relative, so this anchors correctly.
const MarkedPickerDay = styled(PickerDay, {
  shouldForwardProp: (prop) => prop !== 'isHoliday',
})<{ isHoliday?: boolean }>(({ theme, isHoliday }) => ({
  ...(isHoliday && {
    '&::after': {
      content: '""',
      position: 'absolute',
      bottom: 4,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 4,
      height: 4,
      borderRadius: '50%',
      backgroundColor: theme.palette.warning.main,
    },
  }),
}));

export interface HolidayPickerDayProps extends PickerDayProps {
  holidayName?: string;
}

// Adds a dot + tooltip to a calendar day that falls on a public holiday, on top of the existing
// shouldDisableDate blocking — so a holiday is both unselectable and visibly explained why.
const HolidayPickerDay = forwardRef<HTMLButtonElement, HolidayPickerDayProps>(
  ({ holidayName, ...pickerDayProps }, ref) => {
    const day = <MarkedPickerDay {...pickerDayProps} ref={ref} isHoliday={!!holidayName} />;

    if (!holidayName) return day;

    // Disabled buttons don't dispatch hover/focus events at all, so Tooltip can't listen on the day
    // button directly once it's blocked via shouldDisableDate — a plain, unstyled span (unlike Badge,
    // this adds no sizing/positioning of its own) gives Tooltip something that still fires.
    return (
      <Tooltip title={holidayName}>
        <span>{day}</span>
      </Tooltip>
    );
  },
);

HolidayPickerDay.displayName = 'HolidayPickerDay';

export default HolidayPickerDay;
