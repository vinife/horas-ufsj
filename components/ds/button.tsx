import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

type DSButtonProps = React.ComponentProps<"button"> & {
  intent?: "primary" | "secondary" | "danger" | "tertiary"
  size?:
    | "default"
    | "xs"
    | "sm"
    | "lg"
    | "icon"
    | "icon-xs"
    | "icon-sm"
    | "icon-lg"
  asChild?: boolean
}

export function Button({
  intent = "primary",
  size = "default",
  asChild = false,
  className,
  type = "button",
  ...props
}: DSButtonProps) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-intent={intent}
      data-size={size}
      type={asChild ? undefined : type}
      className={cn("ds-button", className)}
      {...props}
    />
  )
}
