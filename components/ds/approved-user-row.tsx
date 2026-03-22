"use client"

import { ManagedUser } from "./users-types"

type ApprovedUserRowProps = {
  user: ManagedUser
}

function formatDate(input: string) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("pt-BR")
}

export function ApprovedUserRow({ user }: ApprovedUserRowProps) {
  if (user.accessStatus !== "APPROVED") {
    return null
  }

  return <>{formatDate(user.createdAt)}</>
}
