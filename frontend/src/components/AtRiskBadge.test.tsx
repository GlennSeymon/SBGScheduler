import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AtRiskReason } from '@sbg/shared';
import AtRiskBadge from './AtRiskBadge';

const reasons: AtRiskReason[] = [
  { rule: 'BAD_WEATHER', message: 'Forecast for 2026-09-21 shows a thunderstorm' },
  { rule: 'UNASSIGNED_STARTING_SOON', message: 'Job starts within 3 days and has no installer' },
];

describe('AtRiskBadge', () => {
  it('renders nothing when the job is not at risk', () => {
    const { container } = render(<AtRiskBadge isAtRisk={false} atRiskReasons={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when the job is not at risk, even if reasons are (incorrectly) present', () => {
    const { container } = render(<AtRiskBadge isAtRisk={false} atRiskReasons={reasons} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the warning icon when the job is at risk', () => {
    render(<AtRiskBadge isAtRisk={true} atRiskReasons={reasons} />);
    expect(screen.getByTestId('WarningAmberIcon')).toBeInTheDocument();
  });

  it('shows every at-risk reason in the tooltip on hover', async () => {
    const user = userEvent.setup();
    render(<AtRiskBadge isAtRisk={true} atRiskReasons={reasons} />);

    await user.hover(screen.getByTestId('WarningAmberIcon'));

    expect(await screen.findByRole('tooltip')).toBeInTheDocument();
    for (const reason of reasons) {
      expect(screen.getByText(reason.message)).toBeInTheDocument();
    }
  });

  it('shows a single reason in the tooltip when only one rule fires', async () => {
    const user = userEvent.setup();
    render(<AtRiskBadge isAtRisk={true} atRiskReasons={[reasons[0]]} />);

    await user.hover(screen.getByTestId('WarningAmberIcon'));

    expect(await screen.findByText(reasons[0].message)).toBeInTheDocument();
    expect(screen.queryByText(reasons[1].message)).not.toBeInTheDocument();
  });
});
