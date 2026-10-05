"use client";

import * as React from "react";
import type { ComplementarHourType } from "@prisma/client";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { Card } from "@/components/ds/card";
import { DeadlineIndicator } from "@/components/ds/deadline-indicator";
import { AdminDialog, type StudentReview } from "@/components/ds/admindialog";
import { notify } from "@/components/ds/notification";
import { StatusBadge } from "@/components/ds/status-badge";
import {
  PaginationControls,
  useAutoPageSize,
} from "@/components/ds/table-pagination";
import { TableLoadingSkeleton } from "@/components/ds/table-loading-skeleton";
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

type SortBy = "deadline" | "name" | "email";
type SortDir = "asc" | "desc";
type StatusFilter = "pending" | "reviewed" | "all";

type DeadlineInfo = {
  deadlineDate: string;
  daysRemaining: number;
  isOverdue: boolean;
};

type StudentDeadline =
  | ({ hasPending: true } & DeadlineInfo)
  | { hasPending: false };

type StudentReviewRow = StudentReview & {
  status: "PENDENTE" | "APROVADO" | "REJEITADO";
  deadline: StudentDeadline;
};

type AdminCardProps = {
  title?: string;
  endpoint?: string;
  uploadType: "complementar" | "extensao";
  className?: string;
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

export function AdminCard({
  title = "Comprovantes enviados",
  endpoint = "/api/admin/uploads",
  uploadType,
  className,
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
    "admin_q",
    parseAsString.withDefault(""),
  );
  const [currentPage, setCurrentPage] = useQueryState(
    "admin_page",
    parseAsInteger.withDefault(1),
  );
  const [sortByRaw, setSortBy] = useQueryState(
    "admin_sortBy",
    parseAsString.withDefault("deadline"),
  );
  const [sortDirRaw, setSortDir] = useQueryState(
    "admin_sortDir",
    parseAsString.withDefault("asc"),
  );
  const [statusFilterRaw, setStatusFilter] = useQueryState(
    "admin_status",
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

  const { data, isLoading, isError } = useQuery({
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
    placeholderData: keepPreviousData,
  });

  const showLoadingSkeleton = isLoading && !data;

  const students = React.useMemo(
    () => (data?.students ?? []) as StudentReviewRow[],
    [data?.students],
  );

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

  const meta = data?.meta;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);

  const handleSort = (key: SortBy) => {
    const nextSortDir =
      sortBy === key ? (sortDir === "asc" ? "desc" : "asc") : "asc";

    setSortBy(key, { history: "replace" });
    setSortDir(nextSortDir, { history: "replace" });
    setCurrentPage(1, { history: "replace" });
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
    complementarHourType?: ComplementarHourType;
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
        complementarHourType: payload.complementarHourType,
      }),
    });

    if (!res.ok) {
      const errorPayload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(errorPayload.error ?? "Falha ao validar certificado.");
    }

    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({
      queryKey: ["admin-notification-counts"],
    });
  };

  const openStudentDialog = (student: StudentReviewRow) => {
    setSelectedStudent(student);
    setIsDialogOpen(true);
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
          className="mx-auto -mt-3 grid w-full sm:max-w-md grid-cols-3 gap-2"
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
                  <SortHeader label="Aluno" field="name" />
                </TableHead>
                <TableHead className="hidden sm:table-cell w-[40%] text-left">
                  <SortHeader label="Email" field="email" />
                </TableHead>
                <TableHead className="w-[16%] text-center">
                  <span className="inline-flex w-full items-center justify-center tracking-wide text-muted-foreground">
                    Status
                  </span>
                </TableHead>
                <TableHead className="w-[14%] text-right">
                  <SortHeader label="Prazo" field="deadline" alignRight />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showLoadingSkeleton ? (
                <TableLoadingSkeleton rows={6} columns={4} />
              ) : !isError && students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Nenhum aluno com arquivos pendentes.
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => {
                  const isPending = student.deadline.hasPending;
                  const pendingFileCount = student.files.filter(
                    (file) => file.status === "PENDENTE",
                  ).length;
                  const deadline = isPending
                    ? ({
                        daysRemaining: student.deadline.daysRemaining,
                        isOverdue: student.deadline.isOverdue,
                      } as const)
                    : null;

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
                      <TableCell className="w-[16%] text-center">
                        <div className="flex justify-center">
                          <StatusBadge
                            pending={isPending}
                            compact={!isPending}
                            count={pendingFileCount}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="w-[14%] text-right">
                        <div className="flex justify-end">
                          <span className="hidden sm:inline-flex">
                            <DeadlineIndicator
                              deadline={deadline}
                              compact={false}
                            />
                          </span>
                          <span className="inline-flex sm:hidden">
                            <DeadlineIndicator deadline={deadline} compact />
                          </span>
                        </div>
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

        <AdminDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          student={selectedStudent}
          uploadType={uploadType}
          onApprove={handleApprove}
          onReject={handleReject}
          onReview={handleReview}
        />
      </Card.Content>
    </Card>
  );
}
