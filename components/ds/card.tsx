import * as React from "react"
import {
  Card as UICard,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type DSCardProps = React.ComponentProps<typeof UICard> & {
  padding?: "sm" | "md" | "lg"
}

export function Card({
  padding = "md",
  className,
  ...props
}: DSCardProps) {
  const paddingStyles = {
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  }

  return (
    <UICard
      className={cn(
        "border-border shadow-sm",
        paddingStyles[padding],
        className
      )}
      {...props}
    />
  )
}

// Reexporta subcomponentes para manter API
Card.Header = CardHeader
Card.Title = CardTitle
Card.Content = CardContent
Card.Footer = CardFooter
