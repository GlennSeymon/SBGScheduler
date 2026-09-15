import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { styled } from '@mui/material/styles';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { rescheduleJobSchema, type RescheduleJobInput, type Job } from '@sbg/shared';
import { format } from 'date-fns';
import { Controller, useForm, type FieldErrors } from 'react-hook-form';
import { useEligibleInstallers } from '../api/useEligibleInstallers';
import { useHolidaysForState } from '../api/useHolidaysForState';
import { useRescheduleJob } from '../api/useRescheduleJob';
import { getApiErrorResponse, getErrorMessage } from '../api/errors';
import { useNotification } from '../notifications/NotificationContext';
import HolidayPickerDay from './HolidayPickerDay';

const Form = styled('form')(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
  paddingTop: theme.spacing(1),
}));

const ErrorAlert = styled(Alert)(({ theme }) => ({
  marginBottom: theme.spacing(2.5),
}));

const FieldsContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
}));

interface RescheduleDialogProps {
  job: Job;
  open: boolean;
  onClose: () => void;
}

const RescheduleDialog = ({ job, open, onClose }: RescheduleDialogProps) => {
  const eligibleInstallers = useEligibleInstallers(job.state);
  const holidayDates = useHolidaysForState(job.state);
  const rescheduleJob = useRescheduleJob();
  const { notify } = useNotification();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RescheduleJobInput>({
    resolver: zodResolver(rescheduleJobSchema),
    defaultValues: {
      installerId: job.assignedInstallerId ?? undefined,
      scheduledStart: job.scheduledStart ?? undefined,
    },
  });

  const handleClose = () => {
    reset();
    rescheduleJob.reset();
    onClose();
  };

  const onSubmit = handleSubmit((input) => {
    rescheduleJob.mutate(
      { jobId: job.id, input },
      {
        onSuccess: () => {
          notify(`Job ${job.id} rescheduled`);
          handleClose();
        },
        onError: (error) => {
          notify(`Job ${job.id} not rescheduled — ${getErrorMessage(error)}`, 'error');
        },
      },
    );
  });

  const errorResponse = getApiErrorResponse(rescheduleJob.error);
  // rescheduleJobSchema's whole-object .refine() has no field path, so zodResolver
  // reports it under the empty-string key rather than a named field.
  const formLevelError = (errors as FieldErrors<RescheduleJobInput> & Record<string, { message?: string } | undefined>)['']
    ?.message;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Reschedule {job.id}</DialogTitle>
      <Form onSubmit={onSubmit}>
        <DialogContent>
          {formLevelError ? (
            <ErrorAlert severity="error">{formLevelError}</ErrorAlert>
          ) : errorResponse?.violations && errorResponse.violations.length > 0 ? (
            <ErrorAlert severity="error">
              {errorResponse.violations.map((violation) => (
                <div key={violation.rule}>{violation.message}</div>
              ))}
            </ErrorAlert>
          ) : errorResponse?.error ? (
            <ErrorAlert severity="error">{errorResponse.error}</ErrorAlert>
          ) : null}

          <FieldsContainer>
            <Controller
              name="installerId"
              control={control}
              render={({ field }) => (
                <FormControl fullWidth error={!!errors.installerId}>
                  <InputLabel id="reschedule-installer-label">Installer</InputLabel>
                  <Select
                    {...field}
                    value={field.value ?? ''}
                    labelId="reschedule-installer-label"
                    label="Installer"
                  >
                    {eligibleInstallers.map((installer) => (
                      <MenuItem key={installer.id} value={installer.id}>
                        {installer.name}
                      </MenuItem>
                    ))}
                  </Select>
                  <FormHelperText>{errors.installerId?.message}</FormHelperText>
                </FormControl>
              )}
            />

            <Controller
              name="scheduledStart"
              control={control}
              render={({ field }) => (
                <DateTimePicker
                  label="Scheduled start"
                  value={field.value ? new Date(field.value) : null}
                  onChange={(newValue) => {
                    if (!newValue || Number.isNaN(newValue.getTime())) {
                      field.onChange(undefined);
                      return;
                    }
                    field.onChange(newValue.toISOString());
                  }}
                  shouldDisableDate={(date) => holidayDates.has(format(date, 'yyyy-MM-dd'))}
                  slots={{ day: HolidayPickerDay }}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.scheduledStart,
                      helperText: errors.scheduledStart?.message,
                    },
                    day: (ownerState) => ({
                      holidayName: holidayDates.get(format(ownerState.day, 'yyyy-MM-dd')),
                    }),
                  }}
                />
              )}
            />
          </FieldsContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="submit" variant="contained" loading={rescheduleJob.isPending}>
            Reschedule
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
};

export default RescheduleDialog;
