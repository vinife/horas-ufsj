import { cn } from "@/lib/utils";

type NotificationBadgeProps = {
  count: number;
  className?: string;
};

export function NotificationBadge({
  count,
  className,
}: NotificationBadgeProps) {
  if (count <= 0) return null;

  const display = count > 99 ? "99+" : String(count);
  const sizeClass =
    display.length === 1
      ? "w-[18px]"
      : display.length === 2
        ? "min-w-[21px] px-1"
        : "min-w-[27px] px-1.5";

  return (
    <span
      className={cn(
        "inline-flex h-4.5 shrink-0 select-none items-center justify-center rounded-full bg-status-pending/90 text-status-pending-foreground text-center text-[10px] font-medium tabular-nums leading-none ring-1 ring-black/10 dark:ring-white/10",
        sizeClass,
        className,
      )}
      aria-label={`${count} item${count > 1 ? "s" : ""} pendente${count > 1 ? "s" : ""}`}
      title={`${count} pendente${count > 1 ? "s" : ""}`}
    >
      {display}
    </span>
  );
}
