import { Users } from "lucide-react";

export const PERMISSION_KEYS = [
  "canManageUsers",
  "canManageExtensao",
  "canManageComplementar",
  "canManageEstagio",
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];

const PERMISSION_META: Record<
  PermissionKey,
  { label: string; icon?: typeof Users; letter?: string }
> = {
  canManageUsers: { label: "Usuários", icon: Users },
  canManageExtensao: { label: "Extensão", letter: "E" },
  canManageComplementar: { label: "Complementar", letter: "C" },
  canManageEstagio: { label: "Estágio", letter: "S" },
};

type PermissionBadgeProps = {
  permission: PermissionKey;
};

export function PermissionBadge({ permission }: PermissionBadgeProps) {
  const { label, icon: Icon, letter } = PERMISSION_META[permission];

  return (
    <span
      className="inline-flex size-7 items-center justify-center rounded-full border border-border bg-muted/50 text-[11px] font-medium text-muted-foreground"
      title={label}
      aria-label={label}
    >
      {Icon ? <Icon className="size-3.5" /> : <span>{letter}</span>}
    </span>
  );
}
