import * as React from "react"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

export type UIButtonVariant =
  | "default"
  | "outline"
  | "secondary"
  | "ghost"
  | "destructive"
  | "link"

export type UIButtonSize =
  | "default"
  | "xs"
  | "sm"
  | "lg"
  | "icon"
  | "icon-xs"
  | "icon-sm"
  | "icon-lg"

/** Compatível com código que importava `buttonVariants` do shadcn / CVA. */
export function buttonVariants(_opts?: {
  variant?: UIButtonVariant
  size?: UIButtonSize
  className?: string
}) {
  return "ui-button"
}

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"button"> & {
  variant?: UIButtonVariant
  size?: UIButtonSize
  asChild?: boolean
}) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn("ui-button", className)}
      {...props}
    />
  )
}

export { Button }
