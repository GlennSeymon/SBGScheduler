import { forwardRef } from 'react';
import Badge from '@mui/material/Badge';
import Tooltip from '@mui/material/Tooltip';
import { styled } from '@mui/material/styles';
import { PickerDay, type PickerDayProps } from '@mui/x-date-pickers/PickerDay';

const HolidayBadge = styled(Badge)({
  width: '100%',
});

export interface HolidayPickerDayProps extends PickerDayProps {
  holidayName?: string;
}

// Adds a dot + tooltip to a calendar day that falls on a public holiday, on top of the existing
// shouldDisableDate blocking — so a holiday is both unselectable and visibly explained why.
const HolidayPickerDay = forwardRef<HTMLButtonElement, HolidayPickerDayProps>(
  ({ holidayName, ...pickerDayProps }, ref) => {
    const day = <PickerDay {...pickerDayProps} ref={ref} />;

    if (!holidayName) return day;

    return (
      <Tooltip title={holidayName}>
        <HolidayBadge color="warning" variant="dot" overlap="circular">
          {day}
        </HolidayBadge>
      </Tooltip>
    );
  },
);

HolidayPickerDay.displayName = 'HolidayPickerDay';

export default HolidayPickerDay;
