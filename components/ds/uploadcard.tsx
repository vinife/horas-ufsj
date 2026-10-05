"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { Card } from "@/components/ds/card";
import { Button } from "@/components/ds/button";
import { FileViewerDialog } from "@/components/ds/file-viewer-dialog";
import { notify } from "@/components/ds/notification";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { UploadInput } from "@/components/ds/uploadinput";
import {
  uploadAccept,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/lib/schemas/upload.schema";
import { cn } from "@/lib/utils";

type FileStatus = "PENDING" | "APPROVED" | "REJECTED";

export type UploadedFile = {
  id: string;
  title: string;
  hours: number;
  status: FileStatus;
  feedback?: string | null;
  fileUrl: string;
  createdAt: string;
};

type UploadCardProps = {
  title?: string;
  subtitle?: string;
  endpoint?: string;
  limit?: number;
  className?: string;
  files?: UploadedFile[];
  onUpload?: (files: File[]) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
};

type UploadProgressContext = {
  setProgress: (progress: number) => void;
};

type UploadFilesResponse = {
  files: UploadedFile[];
  limit?: number;
};

async function fetchFiles(endpoint: string): Promise<UploadFilesResponse> {
  const res = await fetch(endpoint);
  if (!res.ok) {
    throw new Error("Failed to fetch files");
  }
  const data = (await res.json()) as Partial<UploadFilesResponse>;
  return {
    files: data.files ?? [],
    limit: data.limit,
  };
}

async function deleteFile(endpoint: string, id: string) {
  const params = new URLSearchParams({ id });
  const res = await fetch(`${endpoint}?${params.toString()}`, {
    method: "DELETE",
  });

  const data = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;

  if (!res.ok) {
    throw new Error(data?.error ?? "Não foi possível excluir o arquivo.");
  }
}

function formatStatus(status: FileStatus) {
  switch (status) {
    case "APPROVED":
      return { label: "Aprovado", variant: "approved" as const };
    case "REJECTED":
      return { label: "Rejeitado", variant: "denied" as const };
    default:
      return { label: "Pendente", variant: "pending" as const };
  }
}

export function UploadCard({
  title = "Horas",
  subtitle = "Envie seus arquivos em .pdf, .jpeg ou .png para que possam ser avaliados pela coordenação.",
  endpoint = "/api/student/uploads",
  limit,
  className,
  files: providedFiles,
  onUpload,
  onDelete,
}: UploadCardProps) {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [viewingFile, setViewingFile] = React.useState<UploadedFile | null>(
    null,
  );
  const hasShownLoadErrorRef = React.useRef(false);
  const queryKey = React.useMemo(() => ["uploads", endpoint], [endpoint]);
  const { data: fetchedData, isError } = useQuery({
    queryKey,
    queryFn: () => fetchFiles(endpoint),
    enabled: !providedFiles,
  });

  const resolvedData = React.useMemo(() => {
    const resolvedLimit = Number.isFinite(limit ?? NaN)
      ? Number(limit)
      : Number.isFinite(fetchedData?.limit ?? NaN)
        ? Number(fetchedData?.limit)
        : null;

    return {
      files: providedFiles ?? fetchedData?.files ?? [],
      limit: resolvedLimit,
    };
  }, [fetchedData?.files, fetchedData?.limit, limit, providedFiles]);

  const files = resolvedData.files;
  const limitValue = resolvedData.limit;

  const approvedHours = React.useMemo(
    () =>
      files.reduce(
        (total, file) => total + (file.status === "APPROVED" ? file.hours : 0),
        0,
      ),
    [files],
  );
  const progressValue =
    limitValue && limitValue > 0
      ? Math.min((approvedHours / limitValue) * 100, 100)
      : 0;

  React.useEffect(() => {
    if (!isError) {
      hasShownLoadErrorRef.current = false;
      return;
    }

    if (hasShownLoadErrorRef.current) return;
    notify.error(
      "Falha ao carregar arquivos",
      "Não foi possível carregar os arquivos enviados.",
    );
    hasShownLoadErrorRef.current = true;
  }, [isError]);

  const uploadSingleFile = React.useCallback(
    async (file: File, context: UploadProgressContext) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("title", file.name.replace(/\.[^.]+$/, ""));
      formData.append("hours", "1");

      const result = await new Promise<
        { ok: true } | { ok: false; error: string }
      >((resolve) => {
        const xhr = new XMLHttpRequest();

        xhr.open("POST", endpoint);
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            context.setProgress((event.loaded / event.total) * 100);
          }
        };
        xhr.onerror = () => {
          const error =
            xhr.status === 0
              ? "Nao foi possivel ler o arquivo para envio. Tente selecionar o arquivo pelo botao ou mova-o para uma pasta local antes de enviar."
              : "Falha de conexão ao enviar arquivo.";
          resolve({ ok: false, error });
        };
        xhr.onabort = () => {
          resolve({ ok: false, error: "Envio cancelado antes da conclusao." });
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            context.setProgress(100);
            resolve({ ok: true });
            return;
          }

          try {
            const data = JSON.parse(xhr.responseText) as { error?: string };
            resolve({
              ok: false,
              error: data.error ?? "Falha ao enviar arquivo.",
            });
          } catch {
            resolve({ ok: false, error: "Falha ao enviar arquivo." });
          }
        };

        try {
          xhr.send(formData);
        } catch {
          resolve({
            ok: false,
            error:
              "Nao foi possivel ler o arquivo para envio. Tente selecionar o arquivo pelo botao ou mova-o para uma pasta local antes de enviar.",
          });
        }
      });

      if (!result.ok) {
        return { status: "error" as const, error: result.error };
      }

      await queryClient.invalidateQueries({ queryKey });
      return { status: "success" as const };
    },
    [endpoint, queryClient, queryKey],
  );

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id);
      if (onDelete) {
        await onDelete(id);
      } else {
        await deleteFile(endpoint, id);
      }
      await queryClient.invalidateQueries({ queryKey });
      notify.success("Arquivo excluído", "O arquivo foi removido com sucesso.");
    } catch (error) {
      notify.error(
        "Falha ao excluir arquivo",
        error instanceof Error
          ? error.message
          : "Não foi possível excluir o arquivo.",
      );
    } finally {
      setDeletingId((currentId) => (currentId === id ? null : currentId));
    }
  };

  return (
    <Card className={cn("mx-auto w-full max-w-3xl", className)}>
      <Card.Header className="space-y-2 text-center">
        <Card.Title className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </Card.Title>
        <Card.Description className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          {subtitle}
        </Card.Description>
      </Card.Header>

      <Card.Content className="space-y-6">
        <div className="rounded-lg border bg-muted/30 p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">
                Horas aprovadas
              </p>
              <p className="text-xs text-muted-foreground">
                Faltam {limitValue ? limitValue - approvedHours : 0} horas para
                atingir o limite
              </p>
            </div>
            <p className="text-sm font-semibold tabular-nums text-foreground">
              {approvedHours}/{limitValue || 0}
            </p>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <UploadInput
          multiple
          accept={uploadAccept}
          maxSize={MAX_UPLOAD_SIZE_BYTES}
          uploadFile={uploadSingleFile}
          onChange={(files) => onUpload?.(files)}
        />

        {files.length > 0 && (
          <div className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => {
                  const status = formatStatus(file.status);
                  const isDeleteDisabled =
                    file.status === "APPROVED" || deletingId === file.id;
                  const badgeTitle =
                    file.status === "REJECTED" && file.feedback?.trim()
                      ? file.feedback.trim()
                      : file.status === "APPROVED"
                        ? `${file.hours}h aprovada${file.hours === 1 ? "" : "s"}`
                        : undefined;
                  return (
                    <TableRow key={file.id}>
                      <TableCell className="max-w-60 truncate">
                        <button
                          type="button"
                          onClick={() => setViewingFile(file)}
                          className="text-primary hover:underline"
                        >
                          {file.title}
                        </button>
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} title={badgeTitle}>
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          intent="tertiary"
                          size="icon-sm"
                          onClick={() => handleDelete(file.id)}
                          disabled={isDeleteDisabled}
                          aria-label={`Excluir ${file.title}`}
                          title="Excluir"
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card.Content>

      <FileViewerDialog
        open={viewingFile !== null}
        onOpenChange={(open) => {
          if (!open) setViewingFile(null);
        }}
        fileUrl={viewingFile ? `/api/files/certificate/${viewingFile.id}` : ""}
        fileName={viewingFile?.title}
      />
    </Card>
  );
}
