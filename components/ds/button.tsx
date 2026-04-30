import * as React from "react"
import { Button as UIButton } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type DSButtonProps = React.ComponentProps<typeof UIButton> & {
  intent?: "primary" | "secondary" | "danger" | "tertiary"
}

export function Button({
  intent = "primary",
  className,
  ...props
}: DSButtonProps) {
  const intentStyles = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "bg-secondary text-secondary-foreground hover:opacity-90",
    danger: "bg-destructive text-destructive-foreground hover:opacity-90",
    tertiary: "border-2 border-primary bg-transparent text-primary hover:bg-destructive hover:text-accent-foreground",
  }

  return (
    <UIButton
      className={cn(intentStyles[intent], className)}
      {...props}
    />
  )
}
