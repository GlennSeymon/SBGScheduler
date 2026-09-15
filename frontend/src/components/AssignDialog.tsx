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
import { assignJobSchema, type AssignJobInput, type Job } from '@sbg/shared';
import { isAxiosError } from 'axios';
import { useMemo } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useAssignJob } from '../api/useAssignJob';
import { useInstallers } from '../api/useInstallers';

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

interface AssignErrorResponse {
  error: string;
  violations?: RuleViolation[];
}

interface AssignDialogProps {
  job: Job;
  open: boolean;
  onClose: () => void;
}

const AssignDialog = ({ job, open, onClose }: AssignDialogProps) => {
  const { data: installers } = useInstallers();
  const assignJob = useAssignJob();

  // Installers don't cross state lines (tech-stack.md) — the rule engine already rejects a
  // state mismatch server-side, but there's no point offering an installer here who'd just
  // trigger that violation.
  const eligibleInstallers = useMemo(() => {
    // Everything after the first space, so a multi-word surname (e.g. "Te Rangi") stays whole.
    const getSurname = (name: string) => name.slice(name.indexOf(' ') + 1);
    return (installers ?? [])
      .filter((installer) => installer.state === job.state)
      .sort((a, b) => getSurname(a.name).localeCompare(getSurname(b.name)));
  }, [installers, job.state]);

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
        onSuccess: handleClose,
      },
    );
  });

  const errorResponse = isAxiosError<AssignErrorResponse>(assignJob.error)
    ? assignJob.error.response?.data
    : undefined;

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
                    field.onChange(newValue ? newValue.toISOString() : '')
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
