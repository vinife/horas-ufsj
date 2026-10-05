"use client"

import * as React from "react"
import { toast, type ExternalToast } from "sonner"
import { Toaster } from "@/components/ui/sonner"

type NotificationOptions = Omit<ExternalToast, "description"> & {
  title: React.ReactNode
  description?: React.ReactNode
}

type NotificationInput = React.ReactNode | NotificationOptions

function resolveNotification(
  input: NotificationInput,
  description?: React.ReactNode,
): NotificationOptions {
  if (
    typeof input === "string" ||
    typeof input === "number" ||
    React.isValidElement(input)
  ) {
    return { title: input, description }
  }

  return input as NotificationOptions
}

function showNotification(
  type: "success" | "error" | "info" | "warning" | "loading" | "message",
  input: NotificationInput,
  description?: React.ReactNode,
) {
  const { title, ...options } = resolveNotification(input, description)

  if (type === "message") {
    return toast(title, options)
  }

  return toast[type](title, options)
}

export const notify = {
  success: (input: NotificationInput, description?: React.ReactNode) =>
    showNotification("success", input, description),
  error: (input: NotificationInput, description?: React.ReactNode) =>
    showNotification("error", input, description),
  info: (input: NotificationInput, description?: React.ReactNode) =>
    showNotification("info", input, description),
  warning: (input: NotificationInput, description?: React.ReactNode) =>
    showNotification("warning", input, description),
  loading: (input: NotificationInput, description?: React.ReactNode) =>
    showNotification("loading", input, description),
  message: (input: NotificationInput, description?: React.ReactNode) =>
    showNotification("message", input, description),
  dismiss: toast.dismiss,
}

export function Notifications() {
  return (
    <Toaster
      closeButton
      richColors
      position="top-right"
      expand
      duration={4500}
      offset={{ top: 76 }}
    />
  )
}
