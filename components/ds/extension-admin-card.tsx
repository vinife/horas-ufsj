"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ds/card";
import { notify } from "@/components/ds/notification";
import {
  ExtensionAdminDialog,
  type AdminExtensionStudentRow,
} from "@/components/ds/extension-admin-dialog";
import { TableLoadingSkeleton } from "@/components/ds/table-loading-skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ExtensionAdminCardProps = {
  title?: string;
  endpoint?: string;
  className?: string;
};

async function fetchStudents(
  endpoint: string,
): Promise<AdminExtensionStudentRow[]> {
  const res = await fetch(endpoint, { credentials: "include" });
  if (!res.ok) {
    throw new Error("Failed to fetch extension projects");
  }
  const data = (await res.json()) as {
    students?: AdminExtensionStudentRow[];
  };
  return data.students ?? [];
}

function countPending(row: AdminExtensionStudentRow) {
  return row.projects.filter(
    (project) =>
      project.status === "PENDING" ||
      (project.status === "ACTIVE" && project.certificate?.status === "PENDING"),
  ).length;
}

export function ExtensionAdminCard({
  title = "Extensão",
  endpoint = "/api/admin/extensions",
  className,
}: ExtensionAdminCardProps) {
  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => ["admin-extensions", endpoint], [
    endpoint,
  ]);
  const hasShownLoadErrorRef = React.useRef(false);
  const [selectedStudent, setSelectedStudent] =
    React.useState<AdminExtensionStudentRow | null>(null);
  const [isDialogOpen, setIsDialogOpen] = React.useState(false);

  const { data: students, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchStudents(endpoint),
  });

  React.useEffect(() => {
    if (!isError) {
      hasShownLoadErrorRef.current = false;
      return;
    }

    if (hasShownLoadErrorRef.current) return;
    notify.error(
      "Falha ao carregar extensão",
      "Não foi possível carregar os projetos de extensão.",
    );
    hasShownLoadErrorRef.current = true;
  }, [isError]);

  const refreshAfterMutation = React.useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey });
    await queryClient.invalidateQueries({
      queryKey: ["admin-notification-counts"],
    });
  }, [queryClient, queryKey]);

  const openStudentDialog = (student: AdminExtensionStudentRow) => {
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
        {isError && (
          <div className="text-sm text-muted-foreground">
            Tente novamente em instantes.
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[35%]">Aluno</TableHead>
                <TableHead className="hidden sm:table-cell w-[35%] text-left">
                  Email
                </TableHead>
                <TableHead className="w-[15%] text-center">Projetos</TableHead>
                <TableHead className="w-[15%] text-center">
                  Pendentes
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableLoadingSkeleton rows={6} columns={4} />
              ) : !isError && (!students || students.length === 0) ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-muted-foreground">
                    Nenhum projeto de extensão cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                (students ?? []).map((student) => {
                  const pending = countPending(student);

                  return (
                    <TableRow
                      key={student.userId}
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
                      <TableCell className="w-[35%] truncate font-medium">
                        {student.name ?? "-"}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell w-[35%] truncate text-left">
                        {student.email}
                      </TableCell>
                      <TableCell className="w-[15%] text-center">
                        {student.projects.length}
                      </TableCell>
                      <TableCell className="w-[15%] text-center">
                        {pending > 0 ? (
                          <div className="flex justify-center">
                            <Badge variant="pending">{pending}</Badge>
                          </div>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <ExtensionAdminDialog
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          student={selectedStudent}
          onMutated={refreshAfterMutation}
          onStudentUpdate={setSelectedStudent}
        />
      </Card.Content>
    </Card>
  );
}
