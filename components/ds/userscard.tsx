"use client";

import * as React from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { Card } from "@/components/ds/card";
import { notify } from "@/components/ds/notification";
import {
  PaginationControls,
  useAutoPageSize,
} from "@/components/ds/table-pagination";
import { TableLoadingSkeleton } from "@/components/ds/table-loading-skeleton";
import { UnapprovedUserRow } from "@/components/ds/unapproved-user-row";
import { AccessStatusBadge } from "@/components/ds/access-status-badge";
import { RoleBadge } from "@/components/ds/role-badge";
import {
  PERMISSION_KEYS,
  PermissionBadge,
} from "@/components/ds/permission-badge";
import { UserDialog } from "@/components/ds/userdialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { ManagedAccessStatus, ManagedRole, UsersResponse } from "./users-types";
import type { UpdateUserStatusInput } from "@/lib/schemas/user.schema";

type UsersCardProps = {
  title: string;
  className?: string;
};

type RoleFilter = "all" | "admin" | "student";
type SortBy =
  | "name"
  | "email"
  | "status"
  | "role"
  | "permissions"
  | "createdAt";
type SortDir = "asc" | "desc";

function normalizeRoleFilter(value: string): RoleFilter {
  if (value === "admin" || value === "student" || value === "all") {
    return value;
  }
  return "all";
}

function normalizeSortBy(value: string): SortBy {
  if (
    value === "name" ||
    value === "email" ||
    value === "status" ||
    value === "role" ||
    value === "permissions" ||
    value === "createdAt"
  ) {
    return value;
  }
  return "createdAt";
}

function normalizeSortDir(value: string): SortDir {
  return value === "asc" ? "asc" : "desc";
}

async function fetchUsers(
  query: string,
  page: number,
  pageSize: number,
  roleFilter: RoleFilter,
): Promise<UsersResponse> {
  const url = new URL("/api/admin/users", window.location.origin);
  if (query.trim()) {
    url.searchParams.set("q", query.trim());
  }
  if (roleFilter === "admin") {
    url.searchParams.set("role", "ADMIN");
  }
  if (roleFilter === "student") {
    url.searchParams.set("role", "STUDENT");
  }
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));

  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch users");

  const payload = (await res.json()) as Partial<UsersResponse>;
  return {
    users: payload.users ?? [],
    canManage: payload.canManage ?? false,
    meta: payload.meta ?? {
      totalItems: 0,
      totalPages: 1,
      currentPage: 1,
      pageSize,
    },
  };
}

function formatDate(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
}

function renderPermissionSummary(user: UsersResponse["users"][number]) {
  if (user.role !== "ADMIN") {
    return <span className="text-muted-foreground">-</span>;
  }

  const activePermissions = PERMISSION_KEYS.filter(
    (key) => user.permissions[key],
  );

  if (activePermissions.length === 0) {
    return <span className="text-muted-foreground">-</span>;
  }

  return (
    <div className="flex flex-nowrap items-center gap-1 overflow-hidden">
      {activePermissions.map((key) => (
        <PermissionBadge key={key} permission={key} />
      ))}
    </div>
  );
}

function getActivePermissionCount(user: UsersResponse["users"][number]) {
  if (user.role !== "ADMIN") return 0;
  return PERMISSION_KEYS.filter((key) => user.permissions[key]).length;
}

export function UsersCard({ title, className }: UsersCardProps) {
  const [pageSize, setPageSize] = React.useState(10);
  const tableViewportRef = React.useRef<HTMLDivElement>(null!);
  const queryClient = useQueryClient();
  const [searchValue, setSearchValue] = useQueryState(
    "users_q",
    parseAsString.withDefault(""),
  );
  const [currentPage, setCurrentPage] = useQueryState(
    "users_page",
    parseAsInteger.withDefault(1),
  );
  const [roleFilterParam, setRoleFilterParam] = useQueryState(
    "users_role",
    parseAsString.withDefault("all"),
  );
  const [sortByParam, setSortByParam] = useQueryState(
    "users_sort_by",
    parseAsString.withDefault("createdAt"),
  );
  const [sortDirParam, setSortDirParam] = useQueryState(
    "users_sort_dir",
    parseAsString.withDefault("asc"),
  );
  const [draftSearchValue, setDraftSearchValue] = React.useState(searchValue);
  const [actionInFlightUserId, setActionInFlightUserId] = React.useState<
    string | null
  >(null);
  const [activeActionRowId, setActiveActionRowId] = React.useState<
    string | null
  >(null);
  const [selectedUser, setSelectedUser] = React.useState<
    UsersResponse["users"][number] | null
  >(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isSavingDialog, setIsSavingDialog] = React.useState(false);
  const hasShownLoadErrorRef = React.useRef(false);
  const roleFilter = normalizeRoleFilter(roleFilterParam);
  const sortBy = normalizeSortBy(sortByParam);
  const sortDir = normalizeSortDir(sortDirParam);

  React.useEffect(() => {
    setDraftSearchValue(searchValue);
  }, [searchValue]);

  const queryKey = React.useMemo(
    () => [
      "admin-users",
      searchValue.trim(),
      currentPage,
      pageSize,
      roleFilter,
    ],
    [searchValue, currentPage, pageSize, roleFilter],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchUsers(searchValue, currentPage, pageSize, roleFilter),
    placeholderData: keepPreviousData,
  });

  const showLoadingSkeleton = isLoading && !data;

  const users = React.useMemo(() => data?.users ?? [], [data?.users]);
  const canManage = data?.canManage ?? false;
  const meta = data?.meta;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);
  const orderedUsers = React.useMemo(() => {
    if (users.length <= 1) return users;

    const direction = sortDir === "asc" ? 1 : -1;

    return [...users].sort((a, b) => {
      const aIsPending = a.accessStatus === "PENDING";
      const bIsPending = b.accessStatus === "PENDING";
      if (aIsPending !== bIsPending) {
        return aIsPending ? -1 : 1;
      }

      if (sortBy === "createdAt") {
        return (
          (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) *
          direction
        );
      }

      if (sortBy === "role") {
        const roleCompare = a.role.localeCompare(b.role, "pt-BR");
        if (roleCompare !== 0) return roleCompare * direction;
      }

      if (sortBy === "status") {
        const statusCompare = a.accessStatus.localeCompare(
          b.accessStatus,
          "pt-BR",
        );
        if (statusCompare !== 0) return statusCompare * direction;
      }

      if (sortBy === "permissions") {
        const permissionCompare =
          getActivePermissionCount(a) - getActivePermissionCount(b);
        if (permissionCompare !== 0) return permissionCompare * direction;
      }

      if (sortBy === "name") {
        const nameCompare = (a.name ?? "").localeCompare(b.name ?? "", "pt-BR");
        if (nameCompare !== 0) return nameCompare * direction;
      }

      if (sortBy === "email") {
        const emailCompare = a.email.localeCompare(b.email, "pt-BR");
        if (emailCompare !== 0) return emailCompare * direction;
      }

      return a.email.localeCompare(b.email, "pt-BR") * direction;
    });
  }, [users, sortBy, sortDir]);

  useAutoPageSize({
    tableViewportRef,
    setPageSize,
    dependencies: [
      users.length,
      isLoading,
      searchValue,
      currentPage,
      canManage,
      roleFilter,
    ],
  });

  const handleSort = (key: SortBy) => {
    if (sortBy === key) {
      setSortDirParam(sortDir === "asc" ? "desc" : "asc", {
        history: "replace",
      });
      return;
    }

    setSortByParam(key, { history: "replace" });
    setSortDirParam("asc", {
      history: "replace",
    });
  };

  const SortHeader = ({
    label,
    field,
    alignRight,
  }: {
    label: string;
    field: SortBy;
    alignRight?: boolean;
  }) => {
    const active = sortBy === field;

    return (
      <button
        type="button"
        className={cn(
          "inline-flex items-center gap-1 tracking-wide text-muted-foreground transition-colors hover:text-foreground",
          alignRight && "ml-auto",
        )}
        onClick={() => handleSort(field)}
      >
        <span>{label}</span>
        {active &&
          (sortDir === "asc" ? (
            <ChevronUp className="h-3.5 w-3.5" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" />
          ))}
      </button>
    );
  };

  React.useEffect(() => {
    if (!isError) {
      hasShownLoadErrorRef.current = false;
      return;
    }

    if (hasShownLoadErrorRef.current) return;
    notify.error(
      "Falha ao carregar usuários",
      "Não foi possível carregar a lista de usuários.",
    );
    hasShownLoadErrorRef.current = true;
  }, [isError]);

  const handleAccessStatusChange = async (
    userId: string,
    status: ManagedAccessStatus,
    role: ManagedRole,
  ) => {
    setActionInFlightUserId(userId);
    try {
      const payload: UpdateUserStatusInput = {
        userId,
        status,
        role,
      };

      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          payload.error ?? "Não foi possível atualizar a solicitação.",
        );
      }

      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({
        queryKey: ["admin-notification-counts"],
      });
      notify.success(
        status === "APPROVED" ? "Usuário aprovado" : "Usuário rejeitado",
        status === "APPROVED"
          ? "A solicitação foi atualizada com sucesso."
          : "A solicitação foi negada com sucesso.",
      );
    } catch (error) {
      notify.error(
        "Falha ao atualizar solicitação",
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a solicitação.",
      );
    } finally {
      setActionInFlightUserId(null);
    }
  };

  const handleDialogSave = async (
    payload: UpdateUserStatusInput & {
      canManageComplementar?: boolean;
      canManageExtensao?: boolean;
      canManageEstagio?: boolean;
      canManageUsers?: boolean;
    },
  ) => {
    setIsSavingDialog(true);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const responsePayload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(responsePayload.error ?? "Não foi possível salvar.");
      }

      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      await queryClient.invalidateQueries({
        queryKey: ["admin-notification-counts"],
      });
      setDialogOpen(false);
      setSelectedUser(null);
      notify.success("Usuário atualizado", "As alterações foram salvas.");
    } catch (error) {
      notify.error(
        "Falha ao salvar alterações",
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setIsSavingDialog(false);
    }
  };

  const handleUserRowAction = (user: UsersResponse["users"][number]) => {
    if (!canManage) return;

    if (!isPendingUser(user)) {
      setSelectedUser(user);
      setDialogOpen(true);
      setActiveActionRowId(null);
      return;
    }

    setActiveActionRowId((prev) => (prev === user.id ? null : user.id));
  };

  const isPendingUser = (user: UsersResponse["users"][number]) =>
    user.accessStatus === "PENDING";

  return (
    <Card className={cn("flex h-full min-h-0 flex-col", className)}>
      <Card.Header className="justify-center">
        <Card.Title className="text-xl sm:text-2xl text-center font-bold">
          {title}
        </Card.Title>
      </Card.Header>

      <Card.Content className="flex min-h-0 flex-1 flex-col gap-5">
        <form
          className="relative mx-auto w-full sm:max-w-md -mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            setSearchValue(draftSearchValue, { history: "replace" });
            setCurrentPage(1, { history: "replace" });
          }}
        >
          <Input
            value={draftSearchValue}
            onChange={(event) => setDraftSearchValue(event.target.value)}
            placeholder="Buscar por nome ou email..."
            className="pr-10"
          />
          <button
            type="submit"
            aria-label="Buscar"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>

        <RadioGroup
          value={roleFilter}
          onValueChange={(value) => {
            const normalized = normalizeRoleFilter(value);
            setRoleFilterParam(normalized, { history: "replace" });
            setCurrentPage(1, { history: "replace" });
          }}
          className="mx-auto -mt-3 grid w-full sm:max-w-md grid-cols-3 gap-2"
        >
          <label className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm">
            <RadioGroupItem value="admin" />
            Administradores
          </label>
          <label className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm">
            <RadioGroupItem value="student" />
            Alunos
          </label>
          <label className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm">
            <RadioGroupItem value="all" />
            Todos
          </label>
        </RadioGroup>

        {isError ? (
          <div className="text-sm text-muted-foreground">
            Tente novamente em instantes.
          </div>
        ) : null}

        <div ref={tableViewportRef} className="min-h-0 flex-1 overflow-y-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[28%]">
                  <SortHeader label="Nome" field="name" />
                </TableHead>
                <TableHead className="w-[25%]">
                  <SortHeader label="Email" field="email" />
                </TableHead>
                <TableHead className="w-[6%]">
                  <div className="flex justify-center">
                    <SortHeader label="Status" field="status" />
                  </div>
                </TableHead>
                <TableHead className="w-[6%]">
                  <div className="flex justify-center">
                    <SortHeader label="Perfil" field="role" />
                  </div>
                </TableHead>
                <TableHead className="w-[20%]">
                  <SortHeader label="Permissões" field="permissions" />
                </TableHead>
                <TableHead className="w-[15%] text-right">
                  <SortHeader label="Cadastro" field="createdAt" alignRight />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showLoadingSkeleton ? (
                <TableLoadingSkeleton rows={6} columns={6} />
              ) : !isError && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                orderedUsers.map((user) => {
                  const isPending = isPendingUser(user);
                  const isActionActive = activeActionRowId === user.id;

                  return (
                    <TableRow
                      key={user.id}
                      className={cn(
                        "group h-14",
                        isPending
                          ? "bg-status-pending/10 transition-colors hover:bg-status-pending/15"
                          : "bg-transparent",
                        canManage && "cursor-pointer",
                      )}
                      data-active={isActionActive ? "true" : "false"}
                      tabIndex={canManage ? 0 : -1}
                      onClick={() => handleUserRowAction(user)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          handleUserRowAction(user);
                        }
                      }}
                    >
                      <TableCell className="max-w-60">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {user.name ?? "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-70 truncate">
                        {user.email}
                      </TableCell>
                      <TableCell className="text-center">
                        <AccessStatusBadge
                          status={user.accessStatus}
                          iconOnly
                        />
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex justify-center">
                          <RoleBadge role={user.role} iconOnly />
                        </div>
                      </TableCell>
                      <TableCell className="overflow-hidden">
                        {renderPermissionSummary(user)}
                      </TableCell>
                      <TableCell className="relative min-w-32 text-right text-sm text-muted-foreground">
                        {user.accessStatus === "PENDING" ? (
                          <div className="relative flex min-h-8 items-center justify-end pr-1">
                            <span className="tabular-nums transition-opacity duration-200 group-hover:opacity-0 group-data-[active=true]:opacity-0">
                              {formatDate(user.createdAt)}
                            </span>
                            <div
                              className={cn(
                                "pointer-events-none absolute right-1 top-1/2 z-10 flex -translate-y-1/2 items-center justify-end opacity-0 transition-opacity duration-200",
                                "group-hover:pointer-events-auto group-hover:opacity-100 group-data-[active=true]:pointer-events-auto group-data-[active=true]:opacity-100",
                              )}
                            >
                              <UnapprovedUserRow
                                user={user}
                                actionInFlightUserId={actionInFlightUserId}
                                onChangeStatus={handleAccessStatusChange}
                              />
                            </div>
                          </div>
                        ) : (
                          <span className="tabular-nums">
                            {formatDate(user.createdAt)}
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          isLoading={isLoading}
          onPageChange={(page) => setCurrentPage(page, { history: "replace" })}
        />

        <UserDialog
          open={dialogOpen}
          onOpenChange={(nextOpen) => {
            setDialogOpen(nextOpen);
            if (!nextOpen) setSelectedUser(null);
          }}
          user={selectedUser}
          isSaving={isSavingDialog}
          onSave={handleDialogSave}
        />
      </Card.Content>
    </Card>
  );
}
