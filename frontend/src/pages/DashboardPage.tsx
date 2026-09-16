import { useMemo } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Skeleton from '@mui/material/Skeleton';
import { styled } from '@mui/material/styles';
import { PieChart } from '@mui/x-charts/PieChart';
import { BarChart } from '@mui/x-charts/BarChart';
import type { Job } from '@sbg/shared';
import { useJobs } from '../api/useJobs';
import { useInstallers } from '../api/useInstallers';

type Tone = 'warning' | 'error';

const SummaryCard = styled(Card, {
  shouldForwardProp: (prop) => prop !== 'tone',
})<{ tone?: Tone }>(({ theme, tone }) => ({
  height: '100%',
  borderTop: `4px solid ${tone ? theme.palette[tone].main : theme.palette.divider}`,
}));

const CardValue = styled(Typography)({
  fontWeight: 700,
  lineHeight: 1.1,
});

const ChartCard = styled(Card)({
  height: '100%',
});

const CardValueSkeleton = styled(Skeleton)({
  marginTop: 4,
});

// Total + one per status + at-risk + unassigned — kept in sync with `cards` below.
const SUMMARY_CARD_SKELETON_COUNT = 7;

const STATUS_LABELS: Record<Job['status'], string> = {
  UNSCHEDULED: 'Unscheduled',
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
};

const STATUS_ORDER: Job['status'][] = ['UNSCHEDULED', 'SCHEDULED', 'CONFIRMED', 'CANCELLED'];

const ACTIVE_STATUSES: Job['status'][] = ['SCHEDULED', 'CONFIRMED'];

interface SummaryCardData {
  label: string;
  value: number;
  tone?: Tone;
}

const DashboardPage = () => {
  const { data, isLoading: jobsLoading, isError: jobsError } = useJobs();
  const { data: installers, isLoading: installersLoading, isError: installersError } = useInstallers();

  const statusCounts = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        id: status,
        label: STATUS_LABELS[status],
        value: (data ?? []).filter((job) => job.status === status).length,
      })),
    [data],
  );

  const cards = useMemo<SummaryCardData[]>(() => {
    const jobs = data ?? [];

    return [
      { label: 'Total jobs', value: jobs.length },
      ...statusCounts.map(({ label, value }) => ({ label, value })),
      {
        label: 'At risk',
        value: jobs.filter((job) => job.isAtRisk).length,
        tone: 'warning',
      },
      {
        label: 'Unassigned',
        value: jobs.filter((job) => job.assignedInstallerId === null).length,
        tone: 'error',
      },
    ];
  }, [data, statusCounts]);

  const statusPieData = useMemo(
    () => [...statusCounts].sort((a, b) => a.label.localeCompare(b.label)),
    [statusCounts],
  );

  const installerUtilisation = useMemo(() => {
    const jobs = data ?? [];
    return (installers ?? [])
      .map((installer) => ({
        name: installer.name,
        hours: jobs
          .filter(
            (job) =>
              job.assignedInstallerId === installer.id && ACTIVE_STATUSES.includes(job.status),
          )
          .reduce((sum, job) => sum + job.durationBlocks, 0),
      }))
      .sort((a, b) => b.hours - a.hours);
  }, [data, installers]);

  if (jobsError || installersError) {
    return <Typography color="error">Failed to load dashboard data.</Typography>;
  }

  if (jobsLoading || installersLoading) {
    return (
      <Grid container spacing={2}>
        {Array.from({ length: SUMMARY_CARD_SKELETON_COUNT }).map((_, index) => (
          <Grid key={index} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
            <SummaryCard>
              <CardContent>
                <Skeleton variant="text" width="60%" />
                <CardValueSkeleton variant="text" width="40%" height={40} />
              </CardContent>
            </SummaryCard>
          </Grid>
        ))}
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard>
            <CardContent>
              <Skeleton variant="text" width="50%" />
              <Skeleton variant="rectangular" height={300} />
            </CardContent>
          </ChartCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <ChartCard>
            <CardContent>
              <Skeleton variant="text" width="50%" />
              <Skeleton variant="rectangular" height={300} />
            </CardContent>
          </ChartCard>
        </Grid>
      </Grid>
    );
  }

  return (
    <Grid container spacing={2}>
      {cards.map((card) => (
        <Grid key={card.label} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <SummaryCard tone={card.tone}>
            <CardContent>
              <Typography variant="body2" color="text.secondary">
                {card.label}
              </Typography>
              <CardValue variant="h4">{card.value}</CardValue>
            </CardContent>
          </SummaryCard>
        </Grid>
      ))}
      <Grid size={{ xs: 12, md: 6 }}>
        <ChartCard>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Jobs by status
            </Typography>
            <PieChart
              series={[{ data: statusPieData, innerRadius: 40 }]}
              height={300}
            />
          </CardContent>
        </ChartCard>
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
        <ChartCard>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>
              Installer utilisation (scheduled hours)
            </Typography>
            <BarChart
              dataset={installerUtilisation}
              layout="horizontal"
              yAxis={[{ dataKey: 'name', width: 120 }]}
              xAxis={[{ label: 'Hours' }]}
              series={[{ dataKey: 'hours', label: 'Scheduled hours' }]}
              height={Math.max(300, installerUtilisation.length * 36)}
              hideLegend
            />
          </CardContent>
        </ChartCard>
      </Grid>
    </Grid>
  );
};

export default DashboardPage;
