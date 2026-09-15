import Tooltip from '@mui/material/Tooltip';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { AtRiskReason } from '@sbg/shared';

interface AtRiskBadgeProps {
  isAtRisk: boolean;
  atRiskReasons: AtRiskReason[];
}

const AtRiskBadge = ({ isAtRisk, atRiskReasons }: AtRiskBadgeProps) => {
  if (!isAtRisk) return null;

  return (
    <Tooltip
      title={
        <>
          {atRiskReasons.map((reason) => (
            <div key={reason.rule}>{reason.message}</div>
          ))}
        </>
      }
    >
      <WarningAmberIcon color="warning" fontSize="small" />
    </Tooltip>
  );
};

export default AtRiskBadge;
