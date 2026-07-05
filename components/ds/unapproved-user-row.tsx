"use client";

import { Check, X } from "lucide-react";
import { Button } from "@/components/ds/button";
import { ManagedAccessStatus, ManagedRole, ManagedUser } from "./users-types";

type UnapprovedUserRowProps = {
  user: ManagedUser;
  actionInFlightUserId: string | null;
  onChangeStatus: (
    userId: string,
    status: ManagedAccessStatus,
    role: ManagedRole,
  ) => void;
};

export function UnapprovedUserRow({
  user,
  actionInFlightUserId,
  onChangeStatus,
}: UnapprovedUserRowProps) {
  // if (!canManage || user.accessStatus !== "PENDING") {
  //   return null
  // }

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        intent="secondary"
        size="icon-sm"
        className="rounded-full bg-status-approved text-status-approved-foreground shadow-sm hover:bg-status-approved/90"
        disabled={actionInFlightUserId === user.id}
        aria-label="Aprovar solicitação"
        onClick={(event) => {
          event.stopPropagation();
          onChangeStatus(user.id, "APPROVED", user.role);
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <Check className="h-4 w-4" />
      </Button>

      <Button
        type="button"
        intent="secondary"
        size="icon-sm"
        className="rounded-full bg-status-denied text-status-denied-foreground shadow-sm hover:bg-status-denied/90"
        disabled={actionInFlightUserId === user.id}
        aria-label="Negar solicitação"
        onClick={(event) => {
          event.stopPropagation();
          onChangeStatus(user.id, "REJECTED", user.role);
        }}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
