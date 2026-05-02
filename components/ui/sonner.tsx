"use client"

import * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon,
} from "lucide-react"
import { useClientStore } from "@/lib/client-store"

const Toaster = ({ ...props }: ToasterProps) => {
  const theme = useClientStore((state) => state.theme)
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <Sonner
      theme={(mounted ? theme : "light") as ToasterProps["theme"]}
      className="toaster"
      icons={{
        success: <CircleCheckIcon className="sonner-icon" />,
        info: <InfoIcon className="sonner-icon" />,
        warning: <TriangleAlertIcon className="sonner-icon" />,
        error: <OctagonXIcon className="sonner-icon" />,
        loading: <Loader2Icon className="sonner-icon u-animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
