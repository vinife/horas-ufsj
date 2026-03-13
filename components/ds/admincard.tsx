"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { parseAsInteger, parseAsString, useQueryState } from "nuqs"
import { Search } from "lucide-react"
import { Card } from "@/components/ds/card"
import { AdminDialog, type StudentReview } from "@/components/ds/admindialog"
import { PaginationControls, useAutoPageSize } from "@/components/ds/table-pagination"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

type FileStatus = "PENDENTE" | "APROVADO" | "REJEITADO"

export type UploadedFile = {
  id: string
  title: string
  description?: string | null
  hours: number
  status: FileStatus
  fileUrl: string
  createdAt: string
  userName?: string | null
  userEmail?: string | null
}

type StudentReviewRow = StudentReview & {
  status: FileStatus
}

type AdminCardProps = {
  title?: string
  endpoint?: string
  className?: string
  files?: UploadedFile[]
  onApprove?: (id: string) => void | Promise<void>
  onReject?: (id: string) => void | Promise<void>
}

type AdminPaginationMeta = {
  totalItems: number
  totalPages: number
  currentPage: number
  pageSize: number
}

type AdminUploadResponse = {
  students: StudentReviewRow[]
  meta: AdminPaginationMeta
}

async function fetchFiles(
  endpoint: string,
  search: string,
  page: number,
  pageSize: number,
): Promise<AdminUploadResponse> {
  const url = new URL(endpoint, window.location.origin)
  if (search.trim()) {
    url.searchParams.set("q", search.trim())
  }
  url.searchParams.set("page", String(page))
  url.searchParams.set("pageSize", String(pageSize))

  const res = await fetch(url.toString(), { credentials: "include" })
  if (!res.ok) {
    throw new Error("Failed to fetch files")
  }

  const data = (await res.json()) as Partial<AdminUploadResponse>
  return {
    students: data.students ?? [],
    meta: data.meta ?? {
      totalItems: 0,
      totalPages: 1,
      currentPage: 1,
      pageSize,
    },
  }
}

function formatStatus(status: FileStatus) {
  switch (status) {
    case "APROVADO":
      return { label: "Aprovado", variant: "approved" as const }
    case "REJEITADO":
      return { label: "Rejeitado", variant: "denied" as const }
    default:
      return { label: "Pendente", variant: "pending" as const }
  }
}

export function AdminCard({
  title = "Comprovantes enviados",
  endpoint = "/api/admin/uploads",
  className,
  files: initialFiles,
  onApprove,
  onReject,
}: AdminCardProps) {
  const [pageSize, setPageSize] = React.useState(10)
  const queryClient = useQueryClient()
  const [selectedStudent, setSelectedStudent] = React.useState<StudentReviewRow | null>(null)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const tableViewportRef = React.useRef<HTMLDivElement | null>(null)
  const [searchValue, setSearchValue] = useQueryState(
    "q",
    parseAsString.withDefault(""),
  )
  const [currentPage, setCurrentPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1),
  )
  const [draftSearchValue, setDraftSearchValue] = React.useState(searchValue)

  React.useEffect(() => {
    setDraftSearchValue(searchValue)
  }, [searchValue])

  const queryKey = React.useMemo(
    () => ["admin-uploads", endpoint, searchValue.trim(), currentPage, pageSize],
    [endpoint, searchValue, currentPage, pageSize],
  )

  const {
    data: fetchedData,
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => fetchFiles(endpoint, searchValue, currentPage, pageSize),
    enabled: !initialFiles,
  })

  const students = React.useMemo(() => {
    if (fetchedData?.students) return fetchedData.students
    if (!initialFiles) return []

    const grouped = new Map<string, StudentReviewRow>()
    for (const file of initialFiles) {
      const email = file.userEmail ?? "sem-email"
      const existing = grouped.get(email)
      if (existing) {
        existing.files.push({
          id: file.id,
          title: file.title,
          hours: file.hours,
          status: file.status,
          fileUrl: file.fileUrl,
          createdAt: file.createdAt,
        })
        continue
      }

      grouped.set(email, {
        id: file.userEmail ?? file.id,
        name: file.userName ?? null,
        email,
        status: "PENDENTE",
        files: [
          {
            id: file.id,
            title: file.title,
            hours: file.hours,
            status: file.status,
            fileUrl: file.fileUrl,
            createdAt: file.createdAt,
          },
        ],
      })
    }

    return Array.from(grouped.values())
  }, [fetchedData?.students, initialFiles])

  useAutoPageSize({
    tableViewportRef,
    setPageSize,
    dependencies: [students.length, isLoading, searchValue, currentPage],
  })

  const meta = fetchedData?.meta
  const totalPages = Math.max(1, meta?.totalPages ?? 1)

  const handleApprove = async (id: string) => {
    if (!onApprove) return
    await onApprove(id)
    await queryClient.invalidateQueries({ queryKey })
  }

  const handleReject = async (id: string) => {
    if (!onReject) return
    await onReject(id)
    await queryClient.invalidateQueries({ queryKey })
  }

  const openStudentDialog = (student: StudentReviewRow) => {
    setSelectedStudent(student)
    setIsDialogOpen(true)
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
            placeholder="Buscar aluno por nome ou email..."
            className="pr-10 "
          />
          <button
            type="submit"
            aria-label="Buscar"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>
        </form>

        {isLoading && (
          <div className="text-sm text-muted-foreground">Carregando alunos...</div>
        )}
        {isError && (
          <div className="text-sm text-destructive">
            Não foi possível carregar os arquivos.
          </div>
        )}

        <div ref={tableViewportRef} className="min-h-0 flex-1 overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[45%]">Aluno</TableHead>
                <TableHead className="w-[40%] text-left">Email</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!isLoading && students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Nenhum aluno com arquivos pendentes.
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => {
                  const status = formatStatus(student.status)
                  return (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => openStudentDialog(student)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          openStudentDialog(student)
                        }
                      }}
                    >
                      <TableCell className="w-[45%] truncate font-medium">
                        {student.name ?? "-"}
                      </TableCell>
                      <TableCell className="w-[40%] truncate text-left">
                        {student.email}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          <Badge variant={status.variant} className="h-7">
                            {student.status === "PENDENTE" ? (
                              <span className="mr-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-background/85 px-1 text-[10px] font-semibold leading-none text-foreground">
                                {student.files.length}
                              </span>
                            ) : null}
                            {status.label}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>

        {!initialFiles && (
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            isLoading={isLoading}
            onPageChange={(page) => setCurrentPage(page, { history: "replace" })}
          />
        )}

        <AdminDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          student={selectedStudent}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </Card.Content>
    </Card>
  )
}
