import { cn } from "@/lib/utils";
import { Clock3, TriangleAlert } from "lucide-react";

type DeadlineInfo = {
  daysRemaining: number;
  isOverdue: boolean;
};

type DeadlineIndicatorProps = {
  deadline: DeadlineInfo | null;
  compact?: boolean;
};

const NEAR_DEADLINE_DAYS = 3;

export function DeadlineIndicator({
  deadline,
  compact = false,
}: DeadlineIndicatorProps) {
  if (!deadline) {
    return <span className="text-muted-foreground">-</span>;
  }

  if (deadline.isOverdue) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 font-medium text-status-denied",
          compact ? "text-[11px]" : "text-xs",
        )}
      >
        <TriangleAlert className="size-3.5" />
        <span>{compact ? "Venc." : "Vencido"}</span>
      </span>
    );
  }

  const isNearDeadline = deadline.daysRemaining <= NEAR_DEADLINE_DAYS;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-medium",
        isNearDeadline ? "text-status-pending" : "text-foreground",
        compact ? "text-[11px]" : "text-xs",
      )}
    >
      <Clock3 className="size-3.5" />
      <span>
        {compact
          ? `${deadline.daysRemaining}d`
          : `${deadline.daysRemaining} dias`}
      </span>
    </span>
  );
}
