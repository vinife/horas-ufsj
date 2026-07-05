import { GraduationCap, ShieldUser } from "lucide-react";
import { ManagedRole } from "./users-types";

type RoleBadgeProps = {
  role: ManagedRole;
  iconOnly?: boolean;
};

export function RoleBadge({ role, iconOnly = false }: RoleBadgeProps) {
  const label = role === "ADMIN" ? "Administrador" : "Aluno";
  const Icon = role === "ADMIN" ? ShieldUser : GraduationCap;

  if (iconOnly) {
    return (
      <span
        className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-muted/50 font-medium text-muted-foreground"
        title={label}
        aria-label={label}
      >
        <Icon className="size-3.5" />
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
      <Icon className="size-3.5" />
      <span className="whitespace-nowrap">{label}</span>
    </span>
  );
}
