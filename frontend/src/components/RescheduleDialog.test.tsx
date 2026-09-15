import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enAU } from 'date-fns/locale';
import type { Installer, Job } from '@sbg/shared';
import RescheduleDialog from './RescheduleDialog';
import { apiClient } from '../api/client';
import NotificationProvider from '../notifications/NotificationProvider';

const installer: Installer = {
  id: 'INS-01',
  name: 'Marcus Bell',
  state: 'VIC',
  homeBase: 'Ringwood',
  workingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  shiftStart: '07:00',
  shiftEnd: '17:00',
  leaveStart: null,
  leaveEnd: null,
  phone: '0462 855 736',
};

const job: Job = {
  id: 'J-9002',
  customerName: 'Test Customer',
  customerPhone: '0400 000 000',
  customerEmail: 'test@example.com',
  siteAddress: '1 Test St',
  suburb: 'Testville',
  state: 'VIC',
  postcode: '3000',
  jobType: 'BATTERY_INSTALL',
  batteryModel: 'Test Battery',
  // Neither field set, so the form's default values start empty — lets the "submit with
  // nothing changed" test below hit the schema's whole-object refine directly.
  scheduledStart: null,
  durationBlocks: 2,
  status: 'SCHEDULED',
  assignedInstallerId: null,
  assignedInstaller: null,
  notes: null,
  createdAt: '2026-09-01T00:00:00Z',
};

function renderRescheduleDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enAU}>
        <NotificationProvider>
          <RescheduleDialog job={job} open onClose={() => {}} />
        </NotificationProvider>
      </LocalizationProvider>
    </QueryClientProvider>,
  );
}

describe('RescheduleDialog validation', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [installer] });
    vi.spyOn(apiClient, 'patch').mockResolvedValue({ data: job });
  });

  it('rejects submission when neither installer nor time is set, with a form-level message', async () => {
    const user = userEvent.setup();
    renderRescheduleDialog();

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/installers'));

    // Submitting with both fields still at their empty defaults trips the schema's
    // whole-object refine ("provide at least one") — it has no field to attach to, so it
    // must render as a form-level alert rather than a per-field helper text.
    await user.click(screen.getByRole('button', { name: /reschedule/i }));

    await waitFor(() =>
      expect(screen.getByText('Provide a new installer and/or start time')).toBeInTheDocument(),
    );
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('clears the form-level error once an installer is selected', async () => {
    const user = userEvent.setup();
    renderRescheduleDialog();

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/installers'));

    await user.click(screen.getByRole('button', { name: /reschedule/i }));
    await waitFor(() =>
      expect(screen.getByText('Provide a new installer and/or start time')).toBeInTheDocument(),
    );

    await user.click(screen.getByRole('combobox', { name: 'Installer' }));
    await user.click(await screen.findByRole('option', { name: installer.name }));
    await user.click(screen.getByRole('button', { name: /reschedule/i }));

    await waitFor(() => expect(apiClient.patch).toHaveBeenCalled());
    expect(
      screen.queryByText('Provide a new installer and/or start time'),
    ).not.toBeInTheDocument();
  });
});
