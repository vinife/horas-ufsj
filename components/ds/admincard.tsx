"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { Search } from "lucide-react";
import { Card } from "@/components/ds/card";
import { AdminDialog, type StudentReview } from "@/components/ds/admindialog";
import { notify } from "@/components/ds/notification";
import {
  PaginationControls,
  useAutoPageSize,
} from "@/components/ds/table-pagination";
import { TableLoadingSkeleton } from "@/components/ds/table-loading-skeleton";
import { Badge } from "@/components/ui/badge";
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

type FileStatus =
  | "PENDENTE"
  | "APROVADO"
  | "REJEITADO"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

type DisplayFileStatus = "PENDENTE" | "APROVADO" | "REJEITADO";
type SortBy = "deadline" | "name" | "email";
type SortDir = "asc" | "desc";
type StatusFilter = "pending" | "reviewed" | "all";

const CERTIFICATE_REVIEW_DEADLINE_DAYS = 15;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type DeadlineInfo = {
  deadlineDate: string;
  daysRemaining: number;
  isOverdue: boolean;
};

type StudentDeadline =
  | ({ hasPending: true } & DeadlineInfo)
  | { hasPending: false };

export type UploadedFile = {
  id: string;
  title: string;
  description?: string | null;
  hours: number;
  status: FileStatus;
  fileUrl: string;
  createdAt: string;
  deadline?: DeadlineInfo | null;
  aiStatus?: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | null;
  aiSuggestedTitle?: string | null;
  aiSuggestedHours?: number | null;
  aiFeedback?: unknown;
  userName?: string | null;
  userEmail?: string | null;
};

type StudentReviewRow = StudentReview & {
  status: DisplayFileStatus;
  deadline: StudentDeadline;
};

type AdminCardProps = {
  title?: string;
  endpoint?: string;
  className?: string;
  files?: UploadedFile[];
  onApprove?: (id: string) => void | Promise<void>;
  onReject?: (id: string) => void | Promise<void>;
};

type AdminPaginationMeta = {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
};

type AdminUploadResponse = {
  students: StudentReviewRow[];
  meta: AdminPaginationMeta;
};

async function fetchFiles(
  endpoint: string,
  search: string,
  page: number,
  pageSize: number,
  sortBy: SortBy,
  sortDir: SortDir,
  statusFilter: StatusFilter,
): Promise<AdminUploadResponse> {
  const url = new URL(endpoint, window.location.origin);
  if (search.trim()) {
    url.searchParams.set("q", search.trim());
  }
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));
  url.searchParams.set("sortBy", sortBy);
  url.searchParams.set("sortDir", sortDir);
  url.searchParams.set("statusFilter", statusFilter);

  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) {
    throw new Error("Failed to fetch files");
  }

  const data = (await res.json()) as Partial<AdminUploadResponse>;
  return {
    students: data.students ?? [],
    meta: data.meta ?? {
      totalItems: 0,
      totalPages: 1,
      currentPage: 1,
      pageSize,
    },
  };
}

function normalizeStatus(status: FileStatus): DisplayFileStatus {
  if (status === "APPROVED") return "APROVADO";
  if (status === "REJECTED") return "REJEITADO";
  if (status === "PENDING") return "PENDENTE";
  return status;
}

function toSortBy(value: string): SortBy {
  if (value === "name" || value === "email" || value === "deadline") {
    return value;
  }
  return "deadline";
}

function toSortDir(value: string): SortDir {
  return value === "desc" ? "desc" : "asc";
}

function toStatusFilter(value: string): StatusFilter {
  if (value === "pending" || value === "reviewed" || value === "all") {
    return value;
  }
  return "all";
}

function compareStrings(a: string | null, b: string | null, dir: SortDir) {
  const comparison = (a ?? "").localeCompare(b ?? "", "pt-BR", {
    sensitivity: "base",
  });
  return dir === "asc" ? comparison : -comparison;
}

function compareByDeadline(
  a: StudentReviewRow,
  b: StudentReviewRow,
  dir: SortDir,
) {
  if (a.deadline.hasPending !== b.deadline.hasPending) {
    return a.deadline.hasPending ? -1 : 1;
  }

  if (a.deadline.hasPending && b.deadline.hasPending) {
    const comparison =
      new Date(a.deadline.deadlineDate).getTime() -
      new Date(b.deadline.deadlineDate).getTime();
    if (comparison !== 0) {
      return dir === "asc" ? comparison : -comparison;
    }
  }

  const nameComparison = compareStrings(a.name, b.name, dir);
  if (nameComparison !== 0) {
    return nameComparison;
  }

  return compareStrings(a.email, b.email, dir);
}

function calculateDeadline(createdAt: string | Date): DeadlineInfo {
  const createdAtMs = new Date(createdAt).getTime();
  const nowMs = Date.now();
  const elapsedDays = Math.floor((nowMs - createdAtMs) / DAY_IN_MS);
  const daysRemaining = CERTIFICATE_REVIEW_DEADLINE_DAYS - elapsedDays;

  return {
    deadlineDate: new Date(
      createdAtMs + CERTIFICATE_REVIEW_DEADLINE_DAYS * DAY_IN_MS,
    ).toISOString(),
    daysRemaining,
    isOverdue: daysRemaining < 0,
  };
}

export function AdminCard({
  title = "Comprovantes enviados",
  endpoint = "/api/admin/uploads",
  className,
  files: initialFiles,
  onApprove,
  onReject,
}: AdminCardProps) {
  const [pageSize, setPageSize] = React.useState(10);
  const queryClient = useQueryClient();
  const [selectedStudent, setSelectedStudent] =
    React.useState<StudentReviewRow | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const tableViewportRef = React.useRef<HTMLDivElement>(
    null,
  ) as React.RefObject<HTMLDivElement>;
  const [searchValue, setSearchValue] = useQueryState(
    "q",
    parseAsString.withDefault(""),
  );
  const [currentPage, setCurrentPage] = useQueryState(
    "page",
    parseAsInteger.withDefault(1),
  );
  const [sortByRaw, setSortBy] = useQueryState(
    "sortBy",
    parseAsString.withDefault("deadline"),
  );
  const [sortDirRaw, setSortDir] = useQueryState(
    "sortDir",
    parseAsString.withDefault("asc"),
  );
  const [statusFilterRaw, setStatusFilter] = useQueryState(
    "status",
    parseAsString.withDefault("all"),
  );
  const [draftSearchValue, setDraftSearchValue] = React.useState(searchValue);
  const hasShownLoadErrorRef = React.useRef(false);

  const sortBy = toSortBy(sortByRaw);
  const sortDir = toSortDir(sortDirRaw);
  const statusFilter = toStatusFilter(statusFilterRaw);

  React.useEffect(() => {
    setDraftSearchValue(searchValue);
  }, [searchValue]);

  const queryKey = React.useMemo(
    () => [
      "admin-uploads",
      endpoint,
      searchValue.trim(),
      currentPage,
      pageSize,
      sortBy,
      sortDir,
      statusFilter,
    ],
    [
      endpoint,
      searchValue,
      currentPage,
      pageSize,
      sortBy,
      sortDir,
      statusFilter,
    ],
  );

  const {
    data: fetchedData,
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () =>
      fetchFiles(
        endpoint,
        searchValue,
        currentPage,
        pageSize,
        sortBy,
        sortDir,
        statusFilter,
      ),
    enabled: !initialFiles,
  });

  const students = React.useMemo(() => {
    if (fetchedData?.students) return fetchedData.students;
    if (!initialFiles) return [];

    const grouped = new Map<string, StudentReviewRow>();
    for (const file of initialFiles) {
      const email = file.userEmail ?? "sem-email";
      const existing = grouped.get(email);
      const normalizedStatus = normalizeStatus(file.status);
      const fileWithDeadline = {
        id: file.id,
        title: file.title,
        hours: file.hours,
        status: normalizedStatus,
        fileUrl: file.fileUrl,
        createdAt: file.createdAt,
        deadline:
          normalizedStatus === "PENDENTE"
            ? (file.deadline ?? calculateDeadline(file.createdAt))
            : null,
      };

      if (existing) {
        existing.files.push(fileWithDeadline);
        continue;
      }

      grouped.set(email, {
        id: file.userEmail ?? file.id,
        name: file.userName ?? null,
        email,
        status: "PENDENTE",
        deadline: { hasPending: false },
        files: [fileWithDeadline],
      });
    }

    const groupedStudents = Array.from(grouped.values()).map((student) => {
      const oldestPending = student.files
        .filter((file) => file.status === "PENDENTE")
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
        )[0];

      const deadline = oldestPending
        ? {
            hasPending: true as const,
            ...calculateDeadline(oldestPending.createdAt),
          }
        : { hasPending: false as const };

      return {
        ...student,
        status: oldestPending ? ("PENDENTE" as const) : ("APROVADO" as const),
        deadline,
      };
    });

    const searchedStudents = searchValue.trim()
      ? groupedStudents.filter((student) => {
          const normalizedSearch = searchValue
            .trim()
            .toLocaleLowerCase("pt-BR");
          const name = (student.name ?? "").toLocaleLowerCase("pt-BR");
          const email = student.email.toLocaleLowerCase("pt-BR");
          const hasFileTitle = student.files.some((file) =>
            file.title.toLocaleLowerCase("pt-BR").includes(normalizedSearch),
          );
          return (
            name.includes(normalizedSearch) ||
            email.includes(normalizedSearch) ||
            hasFileTitle
          );
        })
      : groupedStudents;

    const statusFilteredStudents = searchedStudents.filter((student) => {
      if (statusFilter === "pending") {
        return student.deadline.hasPending;
      }
      if (statusFilter === "reviewed") {
        return !student.deadline.hasPending;
      }
      return true;
    });

    return [...statusFilteredStudents].sort((a, b) => {
      if (sortBy === "name") {
        const nameComparison = compareStrings(a.name, b.name, sortDir);
        if (nameComparison !== 0) return nameComparison;
        return compareStrings(a.email, b.email, sortDir);
      }

      if (sortBy === "email") {
        const emailComparison = compareStrings(a.email, b.email, sortDir);
        if (emailComparison !== 0) return emailComparison;
        return compareStrings(a.name, b.name, sortDir);
      }

      return compareByDeadline(a, b, sortDir);
    });
  }, [
    fetchedData?.students,
    initialFiles,
    searchValue,
    sortBy,
    sortDir,
    statusFilter,
  ]);

  useAutoPageSize({
    tableViewportRef,
    setPageSize,
    dependencies: [
      students.length,
      isLoading,
      searchValue,
      currentPage,
      sortBy,
      sortDir,
      statusFilter,
    ],
  });

  const meta = fetchedData?.meta;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);

  React.useEffect(() => {
    if (!isError) {
      hasShownLoadErrorRef.current = false;
      return;
    }

    if (hasShownLoadErrorRef.current) return;
    notify.error(
      "Falha ao carregar comprovantes",
      "Não foi possível carregar os arquivos pendentes.",
    );
    hasShownLoadErrorRef.current = true;
  }, [isError]);

  const handleApprove = async (id: string) => {
    if (!onApprove) return;
    await onApprove(id);
    await queryClient.invalidateQueries({ queryKey });
  };

  const handleReject = async (id: string) => {
    if (!onReject) return;
    await onReject(id);
    await queryClient.invalidateQueries({ queryKey });
  };

  const handleReview = async (payload: {
    id: string;
    decision: "allow" | "deny";
    hours: number;
    commentary?: string;
  }) => {
    const reviewEndpoint = `${endpoint}/${payload.id}`;
    const res = await fetch(reviewEndpoint, {
      method: "PATCH",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        decision: payload.decision,
        hours: payload.hours,
        commentary: payload.commentary,
      }),
    });

    if (!res.ok) {
      const errorPayload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(errorPayload.error ?? "Falha ao validar certificado.");
    }

    await queryClient.invalidateQueries({ queryKey });
  };

  const openStudentDialog = (student: StudentReviewRow) => {
    setSelectedStudent(student);
    setIsDialogOpen(true);
  };

  const handleSortClick = React.useCallback(
    (column: SortBy) => {
      const nextSortDir: SortDir =
        sortBy === column ? (sortDir === "asc" ? "desc" : "asc") : "asc";

      setSortBy(column, { history: "replace" });
      setSortDir(nextSortDir, { history: "replace" });
      setCurrentPage(1, { history: "replace" });
    },
    [setCurrentPage, setSortBy, setSortDir, sortBy, sortDir],
  );

  const renderSortArrow = (column: SortBy) => {
    if (sortBy !== column) return null;
    return sortDir === "asc" ? "↑" : "↓";
  };

  return (
    <Card className={cn("flex h-full min-h-0 flex-col", className)}>
      <Card.Header className="justify-center">
        <Card.Title className="text-xl sm:text-2xl text-center font-bold">
          {title}
        </Card.Title>
      </Card.Header>

      <Card.Content className="flex min-h-0 flex-1 flex-col gap-5">
        <form
          className="relative mx-auto w-full sm:max-w-sm -mt-6"
          onSubmit={(event) => {
            event.preventDefault();
            setSearchValue(draftSearchValue, { history: "replace" });
            setCurrentPage(1, { history: "replace" });
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

        <RadioGroup
          value={statusFilter}
          onValueChange={(value) => {
            const nextFilter = toStatusFilter(value);
            setStatusFilter(nextFilter, { history: "replace" });
            setCurrentPage(1, { history: "replace" });
          }}
          className="mx-auto -mt-3 grid w-full max-w-sm grid-cols-3 gap-2"
        >
          <label className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm">
            <RadioGroupItem value="pending" />
            Pendentes
          </label>
          <label className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm">
            <RadioGroupItem value="reviewed" />
            Revisados
          </label>
          <label className="flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm">
            <RadioGroupItem value="all" />
            Todos
          </label>
        </RadioGroup>

        {isError && (
          <div className="text-sm text-muted-foreground">
            Tente novamente em instantes.
          </div>
        )}

        <div ref={tableViewportRef} className="min-h-0 flex-1 overflow-y-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[45%]">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => handleSortClick("name")}
                  >
                    Aluno {renderSortArrow("name")}
                  </button>
                </TableHead>
                <TableHead className="hidden sm:table-cell w-[40%] text-left">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => handleSortClick("email")}
                  >
                    Email {renderSortArrow("email")}
                  </button>
                </TableHead>
                <TableHead className="w-[15%] text-right">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1"
                    onClick={() => handleSortClick("deadline")}
                  >
                    Prazo {renderSortArrow("deadline")}
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingSkeleton rows={6} columns={3} />
              ) : !isError && students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    Nenhum aluno com arquivos pendentes.
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => {
                  const badge = student.deadline.hasPending
                    ? {
                        variant: "pending" as const,
                        label: student.deadline.isOverdue
                          ? "Pendente · Vencido"
                          : `Pendente · ${student.deadline.daysRemaining}d`,
                      }
                    : {
                        variant: "approved" as const,
                        label: "Finalizado",
                      };

                  return (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => openStudentDialog(student)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openStudentDialog(student);
                        }
                      }}
                    >
                      <TableCell className="w-[45%] truncate font-medium">
                        {student.name ?? "-"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell w-[40%] truncate text-left">
                        {student.email}
                      </TableCell>
                      <TableCell className="w-[15%] text-right">
                        <div className="flex justify-end">
                          <Badge variant={badge.variant} className="h-7">
                            {badge.label}
                          </Badge>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
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
            onPageChange={(page) =>
              setCurrentPage(page, { history: "replace" })
            }
          />
        )}

        <AdminDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          student={selectedStudent}
          onApprove={handleApprove}
          onReject={handleReject}
          onReview={handleReview}
        />
      </Card.Content>
    </Card>
  );
}
