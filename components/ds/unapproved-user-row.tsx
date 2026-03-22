"use client"

import { Check, X } from "lucide-react"
import { Button } from "@/components/ds/button"
import { cn } from "@/lib/utils"
import { ManagedAccessStatus, ManagedRole, ManagedUser } from "./users-types"

type UnapprovedUserRowProps = {
  user: ManagedUser
  isActionActive: boolean
  actionInFlightUserId: string | null
  canManage: boolean
  onChangeStatus: (userId: string, status: ManagedAccessStatus, role: ManagedRole) => void
}

export function UnapprovedUserRow({
  user,
  isActionActive,
  actionInFlightUserId,
  canManage,
  onChangeStatus,
}: UnapprovedUserRowProps) {
  if (!canManage || user.accessStatus !== "PENDING") {
    return null
  }

  return (
    <div
      className={cn(
        "pointer-events-none absolute left-2 top-1/2 z-10 flex -translate-y-1/2 items-center gap-2 opacity-0 transition",
        "group-hover:pointer-events-auto group-hover:opacity-100",
        "group-focus-within:pointer-events-auto group-focus-within:opacity-100",
        isActionActive && "pointer-events-auto opacity-100",
      )}
    >
      <Button
        type="button"
        intent="secondary"
        size="icon-sm"
        className="rounded-full bg-status-approved text-status-approved-foreground shadow-sm hover:bg-status-approved/90"
        disabled={actionInFlightUserId === user.id}
        aria-label="Aprovar solicitação"
        onClick={(event) => {
          event.stopPropagation()
          onChangeStatus(user.id, "APPROVED", user.role)
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Check className="h-4 w-4" />
      </Button>
      {user.role === "ADMIN" ? (
        <Button
          type="button"
          intent="secondary"
          size="icon-sm"
          className="rounded-full bg-status-denied text-status-denied-foreground shadow-sm hover:bg-status-denied/90"
          disabled={actionInFlightUserId === user.id}
          aria-label="Negar solicitação"
          onClick={(event) => {
            event.stopPropagation()
            onChangeStatus(user.id, "REJECTED", user.role)
          }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <X className="h-4 w-4" />
        </Button>
      ) : null}
    </div>
  )
}
