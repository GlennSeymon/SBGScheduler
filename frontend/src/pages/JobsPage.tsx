import { DataGrid, type GridColDef } from '@mui/x-data-grid';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import type { Job } from '@sbg/shared';
import { useJobs } from '../api/useJobs';

const GridWrapper = styled(Box)({
  height: 600,
  width: '100%',
});

const JOB_TYPE_LABELS: Record<Job['jobType'], string> = {
  BATTERY_INSTALL: 'Battery install',
  SOLAR_BATTERY: 'Solar + battery',
  BATTERY_UPGRADE: 'Battery upgrade',
};

const STATUS_LABELS: Record<Job['status'], string> = {
  UNSCHEDULED: 'Unscheduled',
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
};

const columns: GridColDef<Job>[] = [
  { field: 'customerName', headerName: 'Customer', flex: 1, minWidth: 160 },
  {
    field: 'siteAddress',
    headerName: 'Address',
    flex: 1.5,
    minWidth: 220,
    valueGetter: (_value, row) => `${row.siteAddress}, ${row.suburb} ${row.state} ${row.postcode}`,
  },
  {
    field: 'jobType',
    headerName: 'Job type',
    flex: 1,
    minWidth: 150,
    valueGetter: (value: Job['jobType']) => JOB_TYPE_LABELS[value],
  },
  { field: 'batteryModel', headerName: 'Battery model', flex: 1, minWidth: 140 },
  {
    field: 'status',
    headerName: 'Status',
    flex: 0.8,
    minWidth: 120,
    valueGetter: (value: Job['status']) => STATUS_LABELS[value],
  },
  {
    field: 'assignedInstaller',
    headerName: 'Installer',
    flex: 1,
    minWidth: 150,
    valueGetter: (_value, row) => row.assignedInstaller?.name ?? 'Unassigned',
  },
  {
    field: 'scheduledStart',
    headerName: 'Scheduled start',
    flex: 1,
    minWidth: 180,
    valueGetter: (value: Job['scheduledStart']) =>
      value ? new Date(value).toLocaleString('en-AU') : '—',
  },
];

const JobsPage = () => {
  const { data, isLoading, isError } = useJobs();

  if (isError) {
    return <Typography color="error">Failed to load jobs.</Typography>;
  }

  return (
    <GridWrapper>
      <DataGrid
        rows={data ?? []}
        columns={columns}
        loading={isLoading}
        pageSizeOptions={[10, 25, 50]}
        initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
      />
    </GridWrapper>
  );
};

export default JobsPage;
