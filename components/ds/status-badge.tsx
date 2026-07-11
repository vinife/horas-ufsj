import { Badge } from "@/components/ui/badge";
import { CircleDot, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusBadgeProps = {
  pending: boolean;
  compact?: boolean;
  count?: number;
};

export function StatusBadge({
  pending,
  compact = false,
  count,
}: StatusBadgeProps) {
  if (pending) {
    const pendingCount = typeof count === "number" && count > 0 ? count : 0;
    return (
      <Badge
        variant="pending"
        className={cn(
          "gap-1 border-status-pending bg-transparent text-status-pending hover:bg-status-pending/10",
          compact ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
        )}
        title={`${pendingCount} arquivo${pendingCount === 1 ? "" : "s"} pendente${pendingCount === 1 ? "" : "s"}`}
      >
        <CircleDot className="size-3.5" />
        <span className="font-black">{pendingCount}</span>
      </Badge>
    );
  }

  return (
    <Badge
      variant="approved"
      className={cn(
        "size-7 justify-center border-status-approved bg-transparent p-0 text-xs text-status-approved hover:bg-status-approved/10",
        compact && "size-6",
      )}
      title="Finalizado"
      aria-label="Finalizado"
    >
      <Check className="size-3.5" />
    </Badge>
  );
}
