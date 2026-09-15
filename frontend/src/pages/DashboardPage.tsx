import { useMemo } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import { styled } from '@mui/material/styles';
import type { Job } from '@sbg/shared';
import { useJobs } from '../api/useJobs';

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

const STATUS_LABELS: Record<Job['status'], string> = {
  UNSCHEDULED: 'Unscheduled',
  SCHEDULED: 'Scheduled',
  CONFIRMED: 'Confirmed',
  CANCELLED: 'Cancelled',
};

const STATUS_ORDER: Job['status'][] = ['UNSCHEDULED', 'SCHEDULED', 'CONFIRMED', 'CANCELLED'];

interface SummaryCardData {
  label: string;
  value: number;
  tone?: Tone;
}

const DashboardPage = () => {
  const { data, isLoading, isError } = useJobs();

  const cards = useMemo<SummaryCardData[]>(() => {
    const jobs = data ?? [];
    const statusCounts = STATUS_ORDER.map((status) => ({
      label: STATUS_LABELS[status],
      value: jobs.filter((job) => job.status === status).length,
    }));

    return [
      { label: 'Total jobs', value: jobs.length },
      ...statusCounts,
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
  }, [data]);

  if (isError) {
    return <Typography color="error">Failed to load dashboard data.</Typography>;
  }

  if (isLoading) {
    return <Typography>Loading dashboard…</Typography>;
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
    </Grid>
  );
};

export default DashboardPage;
