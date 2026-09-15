import { zodResolver } from '@hookform/resolvers/zod';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import { styled } from '@mui/material/styles';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { rescheduleJobSchema, type RescheduleJobInput, type Job } from '@sbg/shared';
import { isAxiosError } from 'axios';
import { Controller, useForm } from 'react-hook-form';
import { useEligibleInstallers } from '../api/useEligibleInstallers';
import { useRescheduleJob } from '../api/useRescheduleJob';

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

interface RuleViolation {
  rule: string;
  message: string;
}

interface RescheduleErrorResponse {
  error: string;
  violations?: RuleViolation[];
}

interface RescheduleDialogProps {
  job: Job;
  open: boolean;
  onClose: () => void;
}

const RescheduleDialog = ({ job, open, onClose }: RescheduleDialogProps) => {
  const eligibleInstallers = useEligibleInstallers(job.state);
  const rescheduleJob = useRescheduleJob();

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
        onSuccess: handleClose,
      },
    );
  });

  const errorResponse = isAxiosError<RescheduleErrorResponse>(rescheduleJob.error)
    ? rescheduleJob.error.response?.data
    : undefined;

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
      <DialogTitle>Reschedule {job.id}</DialogTitle>
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
                  onChange={(newValue) =>
                    field.onChange(newValue ? newValue.toISOString() : undefined)
                  }
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      error: !!errors.scheduledStart,
                      helperText: errors.scheduledStart?.message,
                    },
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
