"use client";

import * as React from "react";
import {
  keepPreviousData,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { Search } from "lucide-react";
import { Card } from "@/components/ds/card";
import { notify } from "@/components/ds/notification";
import {
  InternshipAdminDialog,
  type AdminInternshipRow,
} from "@/components/ds/internship-admin-dialog";
import {
  PaginationControls,
  useAutoPageSize,
} from "@/components/ds/table-pagination";
import { TableLoadingSkeleton } from "@/components/ds/table-loading-skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type InternshipAdminCardProps = {
  title?: string;
  endpoint?: string;
  className?: string;
};

type InternshipPaginationMeta = {
  totalItems: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
};

type InternshipListResponse = {
  students: AdminInternshipRow[];
  meta: InternshipPaginationMeta;
};

async function fetchInternships(
  endpoint: string,
  search: string,
  page: number,
  pageSize: number,
): Promise<InternshipListResponse> {
  const url = new URL(endpoint, window.location.origin);
  if (search.trim()) {
    url.searchParams.set("q", search.trim());
  }
  url.searchParams.set("page", String(page));
  url.searchParams.set("pageSize", String(pageSize));

  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) {
    throw new Error("Failed to fetch internships");
  }

  const data = (await res.json()) as Partial<InternshipListResponse>;
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

function formatStatus(status: AdminInternshipRow["status"]) {
  switch (status) {
    case "PENDING":
      return { label: "Pendente", variant: "pending" as const };
    case "ACTIVE":
      return { label: "Ativo", variant: "active" as const };
    case "REJECTED":
      return { label: "Rejeitado", variant: "denied" as const };
    case "COMPLETED":
      return { label: "Concluído", variant: "secondary" as const };
    case "TERMINATED":
      return { label: "Encerrado", variant: "outline" as const };
  }
}

export function InternshipAdminCard({
  title = "Estágios",
  endpoint = "/api/admin/internships",
  className,
}: InternshipAdminCardProps) {
  const [pageSize, setPageSize] = React.useState(10);
  const queryClient = useQueryClient();
  const [selectedInternship, setSelectedInternship] =
    React.useState<AdminInternshipRow | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const tableViewportRef = React.useRef<HTMLDivElement>(
    null,
  ) as React.RefObject<HTMLDivElement>;
  const [searchValue, setSearchValue] = useQueryState(
    "estagio_q",
    parseAsString.withDefault(""),
  );
  const [currentPage, setCurrentPage] = useQueryState(
    "estagio_page",
    parseAsInteger.withDefault(1),
  );
  const [draftSearchValue, setDraftSearchValue] = React.useState(searchValue);
  const hasShownLoadErrorRef = React.useRef(false);

  React.useEffect(() => {
    setDraftSearchValue(searchValue);
  }, [searchValue]);

  const queryKey = React.useMemo(
    () => ["admin-internships", endpoint, searchValue.trim(), currentPage, pageSize],
    [endpoint, searchValue, currentPage, pageSize],
  );

  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () =>
      fetchInternships(endpoint, searchValue, currentPage, pageSize),
    placeholderData: keepPreviousData,
  });

  const showLoadingSkeleton = isLoading && !data;

  const students = React.useMemo(
    () => (data?.students ?? []) as AdminInternshipRow[],
    [data?.students],
  );

  useAutoPageSize({
    tableViewportRef,
    setPageSize,
    dependencies: [students.length, isLoading, searchValue, currentPage],
  });

  const meta = data?.meta;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);

  React.useEffect(() => {
    if (!isError) {
      hasShownLoadErrorRef.current = false;
      return;
    }

    if (hasShownLoadErrorRef.current) return;
    notify.error(
      "Falha ao carregar estágios",
      "Não foi possível carregar os estágios cadastrados.",
    );
    hasShownLoadErrorRef.current = true;
  }, [isError]);

  const refreshAfterMutation = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({
      queryKey: ["admin-notification-counts"],
    });
  }, [queryClient, queryKey]);

  const handleReviewSubmission = async (payload: {
    submissionId: string;
    decision: "allow" | "deny";
    commentary?: string;
  }) => {
    const res = await fetch(
      `${endpoint}/${payload.submissionId}`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: payload.decision,
          commentary: payload.commentary,
        }),
      },
    );

    if (!res.ok) {
      const errorPayload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(errorPayload.error ?? "Falha ao validar estágio.");
    }

    const data = (await res.json()) as { internship: AdminInternshipRow };
    setSelectedInternship(data.internship);
    await refreshAfterMutation();
  };

  const handleFinalize = async (payload: {
    status: "COMPLETED" | "TERMINATED";
  }) => {
    if (!selectedInternship) return;

    const res = await fetch(
      `${endpoint}/${selectedInternship.id}/finalize`,
      {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: payload.status }),
      },
    );

    if (!res.ok) {
      const errorPayload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      throw new Error(
        errorPayload.error ?? "Falha ao finalizar estágio.",
      );
    }

    const data = (await res.json()) as { internship: AdminInternshipRow };
    setSelectedInternship(data.internship);
    await refreshAfterMutation();
  };

  const openInternshipDialog = (internship: AdminInternshipRow) => {
    setSelectedInternship(internship);
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

        {isError && (
          <div className="text-sm text-muted-foreground">
            Tente novamente em instantes.
          </div>
        )}

        <div ref={tableViewportRef} className="min-h-0 flex-1 overflow-y-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Aluno</TableHead>
                <TableHead className="hidden sm:table-cell w-[30%] text-left">
                  Email
                </TableHead>
                <TableHead className="w-[15%] text-center">Status</TableHead>
                <TableHead className="w-[20%] text-left">Empresa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {showLoadingSkeleton ? (
                <TableLoadingSkeleton rows={6} columns={4} />
              ) : !isError && students.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Nenhum estágio cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                students.map((student) => {
                  const status = formatStatus(student.status);

                  return (
                    <TableRow
                      key={student.id}
                      className="cursor-pointer"
                      tabIndex={0}
                      onClick={() => openInternshipDialog(student)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          openInternshipDialog(student);
                        }
                      }}
                    >
                      <TableCell className="w-[35%] truncate font-medium">
                        {student.name ?? "-"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell w-[30%] truncate text-left">
                        {student.email}
                      </TableCell>
                      <TableCell className="w-[15%] text-center">
                        <div className="flex justify-center">
                          <Badge variant={status.variant}>
                            {status.label}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="w-[20%] truncate text-left">
                        {student.company}
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

        <InternshipAdminDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          internship={selectedInternship}
          onReviewSubmission={handleReviewSubmission}
          onFinalize={handleFinalize}
        />
      </Card.Content>
    </Card>
  );
}
