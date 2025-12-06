import { cn } from '@/lib/utils';
import { ShipmentStatus, BidStatus } from '@/types/database';

interface StatusBadgeProps {
  status: ShipmentStatus | BidStatus;
  className?: string;
}

const shipmentStatusConfig: Record<ShipmentStatus, { label: string; className: string }> = {
  open: { label: 'مفتوح', className: 'bg-primary/10 text-primary border-primary/20' },
  pending_bids: { label: 'في انتظار العروض', className: 'bg-warning/10 text-warning border-warning/20' },
  bid_accepted: { label: 'تم قبول العرض', className: 'bg-success/10 text-success border-success/20' },
  in_transit: { label: 'قيد النقل', className: 'bg-primary/10 text-primary border-primary/20' },
  completed: { label: 'مكتمل', className: 'bg-success/10 text-success border-success/20' },
  cancelled: { label: 'ملغي', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const bidStatusConfig: Record<BidStatus, { label: string; className: string }> = {
  pending: { label: 'معلّق', className: 'bg-warning/10 text-warning border-warning/20' },
  accepted: { label: 'مقبول', className: 'bg-success/10 text-success border-success/20' },
  rejected: { label: 'مرفوض', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = shipmentStatusConfig[status as ShipmentStatus] || bidStatusConfig[status as BidStatus];
  
  if (!config) return null;

  return (
    <span className={cn(
      'inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border',
      config.className,
      className
    )}>
      {config.label}
    </span>
  );
}
