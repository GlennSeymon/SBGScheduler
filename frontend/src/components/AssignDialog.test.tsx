import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { enAU } from 'date-fns/locale';
import type { Installer, Job } from '@sbg/shared';
import AssignDialog from './AssignDialog';
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
  id: 'J-9001',
  customerName: 'Test Customer',
  customerPhone: '0400 000 000',
  customerEmail: 'test@example.com',
  siteAddress: '1 Test St',
  suburb: 'Testville',
  state: 'VIC',
  postcode: '3000',
  jobType: 'BATTERY_INSTALL',
  batteryModel: 'Test Battery',
  scheduledStart: null,
  durationBlocks: 2,
  status: 'UNSCHEDULED',
  assignedInstallerId: null,
  assignedInstaller: null,
  notes: null,
  createdAt: '2026-09-01T00:00:00Z',
};

function renderAssignDialog() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={enAU}>
        <NotificationProvider>
          <AssignDialog job={job} open onClose={() => {}} />
        </NotificationProvider>
      </LocalizationProvider>
    </QueryClientProvider>,
  );
}

describe('AssignDialog validation', () => {
  beforeEach(() => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({ data: [installer] });
    vi.spyOn(apiClient, 'patch').mockResolvedValue({ data: job });
  });

  it('rejects submission with no installer selected and no time set', async () => {
    const user = userEvent.setup();
    renderAssignDialog();

    // Wait for the eligible-installers query to resolve so the Select has its options.
    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/installers'));

    await user.click(screen.getByRole('button', { name: /assign/i }));

    // The installer Select has no visible helper text wired up (only the error outline), so
    // assert via the Mui-error class on its label rather than message text.
    await waitFor(() =>
      expect(document.getElementById('assign-installer-label')).toHaveClass('Mui-error'),
    );
    expect(screen.getByText('Invalid ISO datetime')).toBeInTheDocument();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });

  it('rejects submission with an invalid/empty scheduled time, even once an installer is selected', async () => {
    const user = userEvent.setup();
    renderAssignDialog();

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledWith('/installers'));

    // First submit attempt populates formState.errors for both fields.
    await user.click(screen.getByRole('button', { name: /assign/i }));
    await waitFor(() =>
      expect(document.getElementById('assign-installer-label')).toHaveClass('Mui-error'),
    );

    // Selecting an installer re-validates and clears just that field's error.
    await user.click(screen.getByRole('combobox', { name: 'Installer' }));
    await user.click(await screen.findByRole('option', { name: installer.name }));
    await user.click(screen.getByRole('button', { name: /assign/i }));

    await waitFor(() =>
      expect(document.getElementById('assign-installer-label')).not.toHaveClass('Mui-error'),
    );
    expect(screen.getByText('Invalid ISO datetime')).toBeInTheDocument();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });
});
