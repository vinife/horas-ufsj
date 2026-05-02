import * as React from "react"
import {
  Card as UICard,
  CardHeader,
  CardTitle,
  CardDescription,
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
  return (
    <UICard
      data-ds-card
      data-padding={padding}
      className={cn(className)}
      {...props}
    />
  )
}

Card.Header = CardHeader
Card.Title = CardTitle
Card.Description = CardDescription
Card.Content = CardContent
Card.Footer = CardFooter
