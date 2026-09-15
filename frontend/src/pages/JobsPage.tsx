import { useMemo, useState } from 'react';
import { DataGrid, type GridColDef, type GridRenderCellParams } from '@mui/x-data-grid';
import { styled } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select, { type SelectChangeEvent } from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { Job, JobWithRisk } from '@sbg/shared';
import { useJobs } from '../api/useJobs';
import AssignDialog from '../components/AssignDialog';
import RescheduleDialog from '../components/RescheduleDialog';

const FilterBar = styled(Box)(({ theme }) => ({
  marginBottom: theme.spacing(2),
}));

const StatusFormControl = styled(FormControl)(({ theme }) => ({
  minWidth: theme.spacing(24),
}));

const GridWrapper = styled(Box)({
  height: 600,
  width: '100%',
});

type StatusFilterValue = Job['status'] | 'ALL';

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

const SORTED_STATUSES = (Object.keys(STATUS_LABELS) as Job['status'][]).sort((a, b) =>
  STATUS_LABELS[a].localeCompare(STATUS_LABELS[b]),
);

const baseColumns: GridColDef<JobWithRisk>[] = [
  { field: 'id', headerName: 'Job ID', width: 100 },
  {
    field: 'isAtRisk',
    headerName: 'At risk',
    width: 90,
    align: 'center',
    headerAlign: 'center',
    sortable: false,
    filterable: false,
    renderCell: (params: GridRenderCellParams<JobWithRisk>) => {
      if (!params.row.isAtRisk) return null;
      return (
        <Tooltip
          title={
            <>
              {params.row.atRiskReasons.map((reason) => (
                <div key={reason.rule}>{reason.message}</div>
              ))}
            </>
          }
        >
          <WarningAmberIcon color="warning" fontSize="small" />
        </Tooltip>
      );
    },
  },
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
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>('ALL');
  const [assigningJob, setAssigningJob] = useState<Job | null>(null);
  const [reschedulingJob, setReschedulingJob] = useState<Job | null>(null);

  const rows = useMemo(() => {
    if (!data) return [];
    return statusFilter === 'ALL' ? data : data.filter((job) => job.status === statusFilter);
  }, [data, statusFilter]);

  const columns = useMemo<GridColDef<JobWithRisk>[]>(
    () => [
      ...baseColumns,
      {
        field: 'actions',
        headerName: 'Actions',
        sortable: false,
        filterable: false,
        minWidth: 130,
        renderCell: (params: GridRenderCellParams<JobWithRisk>) => {
          if (params.row.status === 'UNSCHEDULED') {
            return (
              <Button size="small" onClick={() => setAssigningJob(params.row)}>
                Assign
              </Button>
            );
          }
          if (params.row.status === 'SCHEDULED' || params.row.status === 'CONFIRMED') {
            return (
              <Button size="small" onClick={() => setReschedulingJob(params.row)}>
                Reschedule
              </Button>
            );
          }
          return null;
        },
      },
    ],
    [],
  );

  const handleStatusFilterChange = (event: SelectChangeEvent<StatusFilterValue>) => {
    setStatusFilter(event.target.value as StatusFilterValue);
  };

  if (isError) {
    return <Typography color="error">Failed to load jobs.</Typography>;
  }

  return (
    <>
      <FilterBar>
        <StatusFormControl size="small">
          <InputLabel id="status-filter-label">Status</InputLabel>
          <Select
            labelId="status-filter-label"
            label="Status"
            value={statusFilter}
            onChange={handleStatusFilterChange}
          >
            <MenuItem value="ALL">All</MenuItem>
            {SORTED_STATUSES.map((status) => (
              <MenuItem key={status} value={status}>
                {STATUS_LABELS[status]}
              </MenuItem>
            ))}
          </Select>
        </StatusFormControl>
      </FilterBar>
      <GridWrapper>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={isLoading}
          pageSizeOptions={[10, 25, 50]}
          initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
        />
      </GridWrapper>
      {assigningJob && (
        <AssignDialog job={assigningJob} open={!!assigningJob} onClose={() => setAssigningJob(null)} />
      )}
      {reschedulingJob && (
        <RescheduleDialog
          job={reschedulingJob}
          open={!!reschedulingJob}
          onClose={() => setReschedulingJob(null)}
        />
      )}
    </>
  );
};

export default JobsPage;
