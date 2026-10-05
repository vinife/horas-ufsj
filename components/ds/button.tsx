import * as React from "react";
import { Button as UIButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DSButtonProps = React.ComponentProps<typeof UIButton> & {
  intent?: "primary" | "secondary" | "danger" | "tertiary";
};

export function Button({
  intent = "primary",
  className,
  ...props
}: DSButtonProps) {
  const intentStyles = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary:
      "bg-secondary text-secondary-foreground hover:text-secondary-foreground/90 hover:bg-primary/20",
    danger:
      "bg-destructive text-destructive-foreground hover:bg-destructive/80 hover:text-accent-foreground",
    tertiary:
      "border-2 border-primary bg-transparent text-primary hover:bg-destructive hover:text-accent-foreground",
  };

  return (
    <UIButton className={cn(intentStyles[intent], className)} {...props} />
  );
}
