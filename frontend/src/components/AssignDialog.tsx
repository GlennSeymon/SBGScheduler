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
import { assignJobSchema, type AssignJobInput, type Job } from '@sbg/shared';
import { format } from 'date-fns';
import { Controller, useForm } from 'react-hook-form';
import { useAssignJob } from '../api/useAssignJob';
import { useEligibleInstallers } from '../api/useEligibleInstallers';
import { useHolidaysForState } from '../api/useHolidaysForState';
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

interface AssignDialogProps {
  job: Job;
  open: boolean;
  onClose: () => void;
}

const AssignDialog = ({ job, open, onClose }: AssignDialogProps) => {
  const eligibleInstallers = useEligibleInstallers(job.state);
  const holidayDates = useHolidaysForState(job.state);
  const assignJob = useAssignJob();
  const { notify } = useNotification();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<AssignJobInput>({
    resolver: zodResolver(assignJobSchema),
    defaultValues: { installerId: '', scheduledStart: '' },
  });

  const handleClose = () => {
    reset();
    assignJob.reset();
    onClose();
  };

  const onSubmit = handleSubmit((input) => {
    assignJob.mutate(
      { jobId: job.id, input },
      {
        onSuccess: () => {
          notify(`Job ${job.id} assigned`);
          handleClose();
        },
        onError: (error) => {
          notify(`Job ${job.id} not assigned — ${getErrorMessage(error)}`, 'error');
        },
      },
    );
  });

  const errorResponse = getApiErrorResponse(assignJob.error);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Assign {job.id}</DialogTitle>
      <Form onSubmit={onSubmit}>
        <DialogContent>
          {errorResponse?.violations && errorResponse.violations.length > 0 ? (
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
                  <InputLabel id="assign-installer-label">Installer</InputLabel>
                  <Select
                    {...field}
                    labelId="assign-installer-label"
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
                      field.onChange('');
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
          <Button
            type="submit"
            variant="contained"
            loading={assignJob.isPending}
          >
            Assign
          </Button>
        </DialogActions>
      </Form>
    </Dialog>
  );
};

export default AssignDialog;
