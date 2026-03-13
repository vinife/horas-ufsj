"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { parseAsInteger, parseAsString, useQueryState } from "nuqs"
import { Check, Search, X } from "lucide-react"
import { Card } from "@/components/ds/card"
import { Button } from "@/components/ds/button"
import { PaginationControls, useAutoPageSize } from "@/components/ds/table-pagination"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type ManagedRole = "STUDENT" | "ADMIN"
type ManagedAccessStatus = "PENDING" | "APPROVED" | "REJECTED"

type ManagedUser = {
  id: string
  name: string | null
  email: string
  role: ManagedRole
  accessStatus: ManagedAccessStatus
  createdAt: string
  isMasterAdmin: boolean
}

type UsersResponse = {
  users: ManagedUser[]
  meta: {
    totalItems: number
    totalPages: number
    currentPage: number
    pageSize: number
    pendingItems?: number
  }
  canManage: boolean
}

type UsersCardProps = {
  title: string
  className?: string
}

async function fetchUsers(
  query: string,
  page: number,
  pageSize: number,
): Promise<UsersResponse> {
  const url = new URL("/api/admin/users", window.location.origin)
  if (query.trim()) {
    url.searchParams.set("q", query.trim())
  }
  url.searchParams.set("page", String(page))
  url.searchParams.set("pageSize", String(pageSize))

  const res = await fetch(url.toString(), { credentials: "include" })
  if (!res.ok) throw new Error("Failed to fetch users")

  const payload = (await res.json()) as Partial<UsersResponse>
  return {
    users: payload.users ?? [],
    canManage: payload.canManage ?? false,
    meta: payload.meta ?? {
      totalItems: 0,
      totalPages: 1,
      currentPage: 1,
      pageSize,
    },
  }
}

function formatDate(input: string) {
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("pt-BR")
}

function isManagedRole(value: string): value is ManagedRole {
  return value === "ADMIN" || value === "STUDENT"
}

export function UsersCard({ title, className }: UsersCardProps) {
  const [pageSize, setPageSize] = React.useState(10)
  const tableViewportRef = React.useRef<HTMLDivElement | null>(null)
  const queryClient = useQueryClient()
  const [searchValue, setSearchValue] = useQueryState(
    "users_q",
    parseAsString.withDefault(""),
  )
  const [currentPage, setCurrentPage] = useQueryState(
    "users_page",
    parseAsInteger.withDefault(1),
  )
  const [draftSearchValue, setDraftSearchValue] = React.useState(searchValue)
  const [newEmail, setNewEmail] = React.useState("")
  const [newName, setNewName] = React.useState("")
  const [newRole, setNewRole] = React.useState<ManagedRole>("STUDENT")
  const [actionError, setActionError] = React.useState("")
  const [actionInFlightUserId, setActionInFlightUserId] = React.useState<
    string | null
  >(null)
  const [activeActionRowId, setActiveActionRowId] = React.useState<string | null>(
    null,
  )
  const [submitError, setSubmitError] = React.useState("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    setDraftSearchValue(searchValue)
  }, [searchValue])

  const queryKey = React.useMemo(
    () => ["admin-users", searchValue.trim(), currentPage, pageSize],
    [searchValue, currentPage, pageSize],
  )

  const {
    data,
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => fetchUsers(searchValue, currentPage, pageSize),
  })

  const users = data?.users ?? []
  const canManage = data?.canManage ?? false
  const meta = data?.meta
  const totalPages = Math.max(1, meta?.totalPages ?? 1)
  const orderedUsers = React.useMemo(() => {
    if (users.length <= 1) return users
    const pending = users.filter((user) => user.accessStatus === "PENDING")
    const others = users.filter((user) => user.accessStatus !== "PENDING")
    return [...pending, ...others]
  }, [users])

  useAutoPageSize({
    tableViewportRef,
    setPageSize,
    dependencies: [users.length, isLoading, searchValue, currentPage, canManage],
  })

  const handleCreateOrUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitError("")

    const email = newEmail.trim().toLowerCase()
    if (!email) {
      setSubmitError("Informe um email para autorizar.")
      return
    }

    setIsSubmitting(true)
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          role: newRole,
          name: newName.trim() || undefined,
        }),
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "Falha ao autorizar conta.")
      }

      setNewEmail("")
      setNewName("")
      setNewRole("STUDENT")
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Falha ao autorizar conta.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAccessStatusChange = async (
    userId: string,
    status: ManagedAccessStatus,
    role: ManagedRole,
  ) => {
    setActionError("")
    setActionInFlightUserId(userId)
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          status,
          role,
        }),
      })

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(payload.error ?? "Não foi possível atualizar a solicitação.")
      }

      await queryClient.invalidateQueries({ queryKey: ["admin-users"] })
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a solicitação.",
      )
    } finally {
      setActionInFlightUserId(null)
    }
  }

  return (
    <Card className={cn("flex h-full min-h-0 flex-col", className)}>
      <Card.Header className="justify-center">
        <Card.Title className="text-2xl font-bold">{title}</Card.Title>
      </Card.Header>

      <Card.Content className="flex min-h-0 flex-1 flex-col gap-5">
        <form
          className="relative mx-auto w-full sm:max-w-sm -mt-6"
          onSubmit={(event) => {
            event.preventDefault()
            setSearchValue(draftSearchValue, { history: "replace" })
            setCurrentPage(1, { history: "replace" })
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

        {canManage ? (
          <form
            className="grid gap-3 md:grid-cols-[1fr_1fr_170px_auto]"
            onSubmit={handleCreateOrUpdate}
          >
            <Input
              value={newEmail}
              onChange={(event) => setNewEmail(event.target.value)}
              placeholder="email@ufsj.edu.br"
            />
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder="Nome (opcional)"
            />
            <Select
              value={newRole}
              onValueChange={(value) => {
                if (isManagedRole(value)) {
                  setNewRole(value)
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="STUDENT">Aluno</SelectItem>
                <SelectItem value="ADMIN">Funcionário</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : "Autorizar"}
            </Button>
            {submitError ? (
              <p className="text-sm text-destructive md:col-span-4">{submitError}</p>
            ) : null}
          </form>
        ) : null}
        {actionError ? (
          <p className="text-sm text-destructive">{actionError}</p>
        ) : null}

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Carregando usuários...</div>
        ) : null}
        {isError ? (
          <div className="text-sm text-destructive">
            Não foi possível carregar a lista.
          </div>
        ) : null}

        <div ref={tableViewportRef} className="min-h-0 flex-1 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Perfil</TableHead>
                <TableHead className="text-right">Cadastro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Nenhum usuário encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                orderedUsers.map((user) => {
                  const isPending = user.accessStatus === "PENDING"
                  const isActionActive = activeActionRowId === user.id

                  return (
                    <TableRow
                      key={user.id}
                      className={cn(
                        "group",
                        isPending &&
                          "bg-status-pending/10 transition-colors hover:bg-status-pending/15",
                        isPending && canManage && "cursor-pointer",
                      )}
                      data-active={isActionActive ? "true" : "false"}
                      tabIndex={canManage && isPending ? 0 : -1}
                      onClick={() => {
                        if (!canManage || !isPending) return
                        setActiveActionRowId((prev) => (prev === user.id ? null : user.id))
                      }}
                    >
                      <TableCell className="max-w-[240px]">
                        <div className="flex items-center gap-2">
                          <span className="truncate font-medium">
                            {user.name ?? "-"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={user.role === "ADMIN" ? "approved" : "pending"}>
                            {user.role === "ADMIN" ? "Funcionário" : "Aluno"}
                          </Badge>
                          {user.isMasterAdmin ? (
                            <Badge variant="outline">Master</Badge>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className="relative text-right text-sm text-muted-foreground">
                        {formatDate(user.createdAt)}
                        {canManage && isPending ? (
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
                                handleAccessStatusChange(
                                  user.id,
                                  "APPROVED",
                                  user.role,
                                )
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
                                event.stopPropagation()
                                handleAccessStatusChange(
                                  user.id,
                                  "REJECTED",
                                  user.role,
                                )
                              }}
                              onPointerDown={(event) => event.stopPropagation()}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  )
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
      </Card.Content>
    </Card>
  )
}
