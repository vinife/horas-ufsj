import { CircleDot, UserCheck, UserX } from "lucide-react";
import { ManagedAccessStatus } from "./users-types";

type AccessStatusBadgeProps = {
  status: ManagedAccessStatus;
  iconOnly?: boolean;
};

const STATUS_META: Record<
  ManagedAccessStatus,
  { label: string; className: string; icon: typeof CircleDot }
> = {
  PENDING: {
    label: "Pendente",
    className: "text-status-pending",
    icon: CircleDot,
  },
  REJECTED: {
    label: "Rejeitado",
    className: "text-status-denied",
    icon: UserX,
  },
  APPROVED: {
    label: "Aprovado",
    className: "text-status-approved",
    icon: UserCheck,
  },
};

export function AccessStatusBadge({
  status,
  iconOnly = false,
}: AccessStatusBadgeProps) {
  const { label, className, icon: Icon } = STATUS_META[status];

  if (iconOnly) {
    return (
      <span
        className={`inline-flex size-7 items-center justify-center ${className}`}
        title={label}
        aria-label={label}
      >
        <Icon className="size-3.5" />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${className}`}
    >
      <Icon className="size-3.5" />
      <span>{label}</span>
    </span>
  );
}
