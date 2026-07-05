"use client";

import * as React from "react";
import { Button } from "@/components/ds/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import type { ManagedAccessStatus, ManagedUser } from "./users-types";

type UserDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: ManagedUser | null;
  isSaving: boolean;
  onSave: (payload: {
    userId: string;
    status: ManagedAccessStatus;
    role: "ADMIN" | "STUDENT";
    canManageComplementar?: boolean;
    canManageExtensao?: boolean;
    canManageUsers?: boolean;
  }) => Promise<void>;
};

function statusLabel(status: ManagedAccessStatus) {
  if (status === "APPROVED") return "Aprovado";
  if (status === "REJECTED") return "Bloqueado";
  return "Pendente";
}

export function UserDialog({
  open,
  onOpenChange,
  user,
  isSaving,
  onSave,
}: UserDialogProps) {
  const [status, setStatus] = React.useState<ManagedAccessStatus>("PENDING");
  const [canManageComplementar, setCanManageComplementar] =
    React.useState(false);
  const [canManageExtensao, setCanManageExtensao] = React.useState(false);
  const [canManageUsers, setCanManageUsers] = React.useState(false);

  React.useEffect(() => {
    if (!open || !user) return;
    setStatus(user.accessStatus);
    setCanManageComplementar(user.permissions.canManageComplementar);
    setCanManageExtensao(user.permissions.canManageExtensao);
    setCanManageUsers(user.permissions.canManageUsers);
  }, [open, user]);

  const isAdmin = user?.role === "ADMIN";

  const saveDisabled = !user || isSaving;

  const handleSave = async () => {
    if (!user) return;

    await onSave({
      userId: user.id,
      status,
      role: user.role,
      ...(isAdmin
        ? {
            canManageComplementar,
            canManageExtensao,
            canManageUsers,
          }
        : {}),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Gerenciar usuário</DialogTitle>
          <DialogDescription>
            Atualize permissões de admins e bloqueie/desbloqueie acesso.
          </DialogDescription>
        </DialogHeader>

        {!user ? null : (
          <div className="space-y-5">
            <div className="rounded-lg border p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{user.name ?? "Usuário"}</p>
                <Badge variant={user.role === "ADMIN" ? "approved" : "pending"}>
                  {user.role === "ADMIN" ? "Administrador" : "Aluno"}
                </Badge>
                <Badge variant={status === "REJECTED" ? "denied" : "outline"}>
                  {statusLabel(status)}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
            </div>

            <div className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">Conta bloqueada</p>
                  <p className="text-xs text-muted-foreground">
                    Usuários bloqueados ficam com acesso negado ao sistema.
                  </p>
                </div>
                <Switch
                  checked={status === "REJECTED"}
                  onCheckedChange={(checked) =>
                    setStatus(checked ? "REJECTED" : "APPROVED")
                  }
                  disabled={isSaving}
                  aria-label="Bloquear usuário"
                />
              </div>
            </div>

            {isAdmin ? (
              <div className="rounded-lg border p-4 space-y-4">
                <p className="text-sm font-medium">
                  Permissões do administrador
                </p>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm">Gerenciar Complementar</p>
                    <p className="text-xs text-muted-foreground">
                      Libera a aba e os cards de Complementar.
                    </p>
                  </div>
                  <Switch
                    checked={canManageComplementar}
                    onCheckedChange={setCanManageComplementar}
                    disabled={isSaving || status === "REJECTED"}
                    aria-label="Permissão de complementar"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm">Gerenciar Extensão</p>
                    <p className="text-xs text-muted-foreground">
                      Libera a aba e os cards de Extensão.
                    </p>
                  </div>
                  <Switch
                    checked={canManageExtensao}
                    onCheckedChange={setCanManageExtensao}
                    disabled={isSaving || status === "REJECTED"}
                    aria-label="Permissão de extensão"
                  />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm">Gerenciar Usuários</p>
                    <p className="text-xs text-muted-foreground">
                      Permite aprovar, bloquear e editar outros usuários.
                    </p>
                  </div>
                  <Switch
                    checked={canManageUsers}
                    onCheckedChange={setCanManageUsers}
                    disabled={isSaving || status === "REJECTED"}
                    aria-label="Permissão de usuários"
                  />
                </div>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter>
          <Button
            intent="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button intent="primary" onClick={handleSave} disabled={saveDisabled}>
            {isSaving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
