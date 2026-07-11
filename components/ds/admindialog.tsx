"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Eye,
  ImageOff,
  LoaderCircle,
  Save,
  Sparkles,
} from "lucide-react";
import { notify } from "@/components/ds/notification";
import { Badge } from "@/components/ui/badge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ds/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

type FileStatus = "PENDENTE" | "APROVADO" | "REJEITADO";

export type StudentReviewFile = {
  id: string;
  title: string;
  hours: number;
  status: FileStatus;
  feedback?: string | null;
  fileUrl: string;
  createdAt: string | Date;
  aiStatus?: "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED" | null;
  aiDecision?: "PENDING" | "APPROVED" | "REJECTED" | null;
  aiSuggestedTitle?: string | null;
  aiSuggestedHours?: number | null;
  aiFeedback?: unknown;
};

export type StudentReview = {
  id: string;
  name: string | null;
  email: string;
  status: FileStatus;
  files: StudentReviewFile[];
};

type AdminDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: StudentReview | null;
  onApprove?: (id: string) => void | Promise<void>;
  onReject?: (id: string) => void | Promise<void>;
  onReview?: (payload: {
    id: string;
    decision: "allow" | "deny";
    hours: number;
    commentary?: string;
  }) => void | Promise<void>;
};

function formatStatus(status: FileStatus) {
  switch (status) {
    case "APROVADO":
      return { label: "Aprovado", variant: "approved" as const };
    case "REJEITADO":
      return { label: "Rejeitado", variant: "denied" as const };
    default:
      return { label: "Pendente", variant: "pending" as const };
  }
}

function formatDate(input: string | Date) {
  const date = input instanceof Date ? input : new Date(input);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
}

function formatAiStatus(aiStatus: StudentReviewFile["aiStatus"]) {
  switch (aiStatus) {
    case "QUEUED":
      return {
        label: "IA",
        title: "A análise da IA está na fila",
        className:
          "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
      };
    case "PROCESSING":
      return {
        label: "IA",
        title: "A análise da IA está em andamento",
        className:
          "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
      };
    case "COMPLETED":
      return {
        label: "IA",
        title: "A análise da IA foi concluída",
        className:
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
      };
    case "FAILED":
      return {
        label: "IA",
        title: "A análise da IA falhou",
        className: "border-destructive/40 bg-destructive/10 text-destructive",
      };
    default:
      return null;
  }
}

function stringifyAiFeedback(aiFeedback: unknown) {
  if (typeof aiFeedback === "string") {
    const text = aiFeedback.trim();
    return text.length > 0 ? text : null;
  }

  if (Array.isArray(aiFeedback)) {
    const text = aiFeedback
      .map((item) => (typeof item === "string" ? item : JSON.stringify(item)))
      .join("; ")
      .trim();
    return text.length > 0 ? text : null;
  }

  if (aiFeedback && typeof aiFeedback === "object") {
    const record = aiFeedback as Record<string, unknown>;

    const directText =
      (typeof record.message === "string" && record.message.trim()) ||
      (typeof record.summary === "string" && record.summary.trim()) ||
      (typeof record.reason === "string" && record.reason.trim()) ||
      (typeof record.error === "string" && record.error.trim());

    if (directText) return directText;

    const serialized = JSON.stringify(record);
    return serialized && serialized !== "{}" ? serialized : null;
  }

  return null;
}

function getAiHoursPlaceholder(file: StudentReviewFile) {
  if (file.aiStatus !== "COMPLETED") return null;
  if (!Number.isFinite(file.aiSuggestedHours ?? NaN)) return null;
  const value = Number(file.aiSuggestedHours);
  if (value < 0 || value > 120) return null;
  return value;
}

function getAiFeedbackPlaceholder(file: StudentReviewFile) {
  if (file.aiStatus !== "COMPLETED") return null;
  if (file.aiDecision !== "REJECTED") return null;
  return stringifyAiFeedback(file.aiFeedback);
}

function getAiSuggestedTitle(file: StudentReviewFile) {
  if (file.aiStatus !== "COMPLETED") return null;
  const title = file.aiSuggestedTitle?.trim();
  return title?.length ? title : null;
}

type ReviewFormState = {
  decision: "allow" | "deny" | null;
  valuedHours: number | null;
  commentary: string;
};

function toDecisionFromCertificateStatus(status: FileStatus) {
  if (status === "APROVADO") return "allow" as const;
  if (status === "REJEITADO") return "deny" as const;
  return null;
}

function toDecisionFromAiDecision(file: StudentReviewFile) {
  if (file.aiStatus !== "COMPLETED") return null;
  if (file.aiDecision === "APPROVED") return "allow" as const;
  if (file.aiDecision === "REJECTED") return "deny" as const;
  return null;
}

function getInitialReviewState(file: StudentReviewFile): ReviewFormState {
  const isReviewed = file.status !== "PENDENTE";

  if (isReviewed) {
    return {
      decision: toDecisionFromCertificateStatus(file.status),
      valuedHours: Math.max(0, Math.min(100, file.hours)),
      commentary: file.status === "REJEITADO" ? (file.feedback ?? "") : "",
    };
  }

  const aiSuggestedHours = getAiHoursPlaceholder(file);
  const aiDecision = toDecisionFromAiDecision(file);
  return {
    decision: aiDecision,
    valuedHours: aiSuggestedHours !== null ? null : 0,
    commentary:
      aiDecision === "deny" ? (getAiFeedbackPlaceholder(file) ?? "") : "",
  };
}

export function AdminDialog({
  open,
  onOpenChange,
  student,
  onApprove,
  onReject,
  onReview,
}: AdminDialogProps) {
  const [reviewStateByFileId, setReviewStateByFileId] = React.useState<
    Record<string, ReviewFormState>
  >({});
  const [savingByFileId, setSavingByFileId] = React.useState<
    Record<string, boolean>
  >({});
  const [viewingFile, setViewingFile] =
    React.useState<StudentReviewFile | null>(null);
  const [imageError, setImageError] = React.useState(false);

  React.useEffect(() => {
    if (!open || !student) return;

    const nextState: Record<string, ReviewFormState> = {};
    for (const file of student.files) {
      nextState[file.id] = getInitialReviewState(file);
    }

    setReviewStateByFileId(nextState);
    setSavingByFileId({});
  }, [open, student]);

  React.useEffect(() => {
    if (open) return;
    setViewingFile(null);
    setImageError(false);
  }, [open]);

  const updateFileState = React.useCallback(
    (fileId: string, updater: (prev: ReviewFormState) => ReviewFormState) => {
      setReviewStateByFileId((prev) => {
        const current = prev[fileId] ?? {
          decision: null,
          valuedHours: 0,
          commentary: "",
        };
        return {
          ...prev,
          [fileId]: updater(current),
        };
      });
    },
    [],
  );

  const handleSubmitReview = React.useCallback(
    async (file: StudentReviewFile) => {
      const state = reviewStateByFileId[file.id];
      if (!state) return;

      if (file.status !== "PENDENTE") {
        notify.info(
          "Arquivo já revisado",
          "Este certificado já foi validado por um administrador.",
        );
        return;
      }

      if (state.decision === null) {
        notify.warning(
          "Decisão obrigatória",
          "Selecione Aprovar ou Negar antes de salvar.",
        );
        return;
      }

      if (
        state.decision === "allow" &&
        (state.valuedHours === null ||
          !Number.isFinite(state.valuedHours) ||
          state.valuedHours < 0 ||
          state.valuedHours > 100)
      ) {
        notify.error(
          "Horas inválidas",
          "Informe horas validadas entre 0 e 100.",
        );
        return;
      }

      const finalCommentary =
        state.commentary.trim() || getAiFeedbackPlaceholder(file) || "";

      if (state.decision === "deny" && !finalCommentary) {
        notify.warning(
          "Justificativa obrigatória",
          "Adicione uma justificativa quando o arquivo for negado.",
        );
        return;
      }

      setSavingByFileId((prev) => ({ ...prev, [file.id]: true }));
      try {
        if (onReview) {
          await onReview({
            id: file.id,
            decision: state.decision,
            hours: state.decision === "allow" ? (state.valuedHours ?? 0) : 0,
            commentary: finalCommentary || undefined,
          });
        } else if (state.decision === "allow") {
          // O código anterior para onApprove e onReject foi movido para dentro do onReview
          // para centralizar a lógica e permitir a atualização local do estado.
          // Esta parte do código pode ser removida se a migração para onReview for completa.
          // Por enquanto, manteremos a lógica de atualização local aqui também.
          updateFileState(file.id, (prev) => ({
            ...prev,
            status: "APROVADO",
          }));
          if (!onApprove) {
            notify.info(
              "Ação indisponível",
              "A aprovação ainda não está configurada para este fluxo.",
            );
            return;
          }
          await onApprove(file.id);
        } else {
          // Atualiza o estado local para "REJEITADO"
          updateFileState(file.id, (prev) => ({
            ...prev,
            status: "REJEITADO",
          }));
          if (!onReject) {
            notify.info(
              "Ação indisponível",
              "A rejeição ainda não está configurada para este fluxo.",
            );
            return;
          }
          await onReject(file.id);
        }

        // Atualiza o estado local do arquivo para refletir a avaliação
        updateFileState(file.id, (prev) => ({
          ...prev,
          // @ts-expect-error - decision is "allow" or "deny"
          status: state.decision === "allow" ? "APROVADO" : "REJEITADO",
          hours: state.valuedHours ?? file.hours,
          feedback: finalCommentary || file.feedback,
        }));

        notify.success(
          state.decision === "allow" ? "Arquivo aprovado" : "Arquivo rejeitado",
          `${file.title} foi avaliado com sucesso.`,
        );
      } catch (error) {
        notify.error(
          "Falha ao salvar avaliação",
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a avaliação.",
        );
      } finally {
        setSavingByFileId((prev) => ({ ...prev, [file.id]: false }));
      }
    },
    [onApprove, onReject, onReview, reviewStateByFileId],
  );

  const handleOpenFileViewer = React.useCallback((file: StudentReviewFile) => {
    setImageError(false);
    setViewingFile(file);
  }, []);

  const handleCloseFileViewer = React.useCallback(() => {
    setViewingFile(null);
    setImageError(false);
  }, []);

  const viewingFileUrl = viewingFile?.fileUrl?.trim() ?? "";
  const canRenderImage = viewingFileUrl.length > 0 && !imageError;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[85vh] overflow-y-auto sm:max-w-3xl",
          viewingFile &&
            "h-dvh max-h-dvh w-screen max-w-none overflow-hidden rounded-none border-0 p-4 sm:h-auto sm:max-h-[90vh] sm:max-w-[90vw] sm:rounded-lg sm:border sm:p-6 lg:max-w-5xl",
        )}
      >
        {viewingFile ? (
          <div className="flex h-full min-h-0 flex-col gap-4">
            <div className="flex items-center gap-3">
              <Button
                type="button"
                intent="secondary"
                size="sm"
                className="gap-2"
                onClick={handleCloseFileViewer}
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {viewingFile.title}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(viewingFile.createdAt)}
                </p>
              </div>
            </div>

            <div className="flex min-h-[calc(100dvh-8rem)] flex-1 items-center justify-center overflow-hidden rounded-lg border bg-muted/20 sm:min-h-[65vh]">
              {canRenderImage ? (
                <Image
                  src={viewingFileUrl}
                  alt={`Certificado ${viewingFile.title}`}
                  className="h-[calc(100dvh-8rem)] w-full object-contain sm:h-[65vh]"
                  onError={() => setImageError(true)}
                  width={1200}
                  height={800} /* <-- ADICIONE O HEIGHT AQUI */
                  unoptimized={viewingFileUrl.includes("drive.google.com")}
                />
              ) : (
                <div className="flex min-h-[60vh] w-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
                  <ImageOff className="h-10 w-10" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                      Não foi possível carregar a imagem do certificado
                    </p>
                    <p className="text-xs">
                      Verifique se o arquivo possui uma URL válida.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {student?.name ?? "Aluno"}{" "}
                <span className="text-muted-foreground">
                  ({student?.email ?? "-"})
                </span>
              </DialogTitle>
              <DialogDescription>
                Arquivos pendentes para revisao.
              </DialogDescription>
            </DialogHeader>

            {!student || student.files.length === 0 ? (
              <div className="rounded-md border p-4 text-sm text-muted-foreground">
                Nenhum arquivo pendente.
              </div>
            ) : (
              <Accordion type="single" collapsible>
                {student.files.map((file) => {
                  const status = formatStatus(file.status);
                  const isReviewed = file.status !== "PENDENTE";
                  const aiStatus = formatAiStatus(file.aiStatus);
                  const aiSuggestedTitle = getAiSuggestedTitle(file);
                  const aiHoursPlaceholder = getAiHoursPlaceholder(file);
                  const state =
                    reviewStateByFileId[file.id] ?? getInitialReviewState(file);
                  const isDenied = state.decision === "deny";
                  const isSaving = savingByFileId[file.id] === true;

                  return (
                    <AccordionItem key={file.id} value={file.id}>
                      <AccordionTrigger>
                        <div className="flex w-full flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                          <div className="min-w-0 flex-1">
                            <span className="block truncate font-medium">
                              {file.title}
                            </span>
                            {aiSuggestedTitle ? (
                              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                                {aiSuggestedTitle}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex items-center gap-2 sm:gap-3">
                            <span className="text-xs text-muted-foreground">
                              {formatDate(file.createdAt)}
                            </span>
                            {aiStatus ? (
                              <Badge
                                variant="outline"
                                className={cn(
                                  "gap-1 border-dashed",
                                  aiStatus.className,
                                )}
                                title={aiStatus.title}
                              >
                                <Sparkles className="h-3.5 w-3.5" />
                                {aiStatus.label}
                              </Badge>
                            ) : null}
                            <Badge variant={status.variant}>
                              {status.label}
                            </Badge>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="grid gap-4 pt-2">
                          <button
                            type="button"
                            className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-primary transition-colors hover:bg-muted sm:w-fit sm:justify-start"
                            onClick={() => handleOpenFileViewer(file)}
                          >
                            Abrir arquivo
                            <Eye className="h-3.5 w-3.5 shrink-0" />
                          </button>

                          <div className="grid w-full gap-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-end">
                            <div className="grid gap-2">
                              <span className="text-sm font-medium">
                                Decisao
                              </span>
                              <RadioGroup
                                value={state.decision ?? undefined}
                                onValueChange={(value) => {
                                  if (isReviewed) return;
                                  if (value !== "allow" && value !== "deny")
                                    return;
                                  updateFileState(file.id, (prev) => ({
                                    ...prev,
                                    decision: value,
                                    commentary:
                                      value === "deny" ? prev.commentary : "",
                                  }));
                                }}
                                className="grid grid-cols-2 gap-2 sm:gap-3"
                                disabled={isReviewed}
                              >
                                <label className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-70">
                                  <RadioGroupItem value="allow" />
                                  Aprovar
                                </label>
                                <label className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm disabled:opacity-70">
                                  <RadioGroupItem value="deny" />
                                  Negar
                                </label>
                              </RadioGroup>
                            </div>

                            <div className="grid gap-2">
                              <label className="text-sm font-medium">
                                Horas validadas
                              </label>
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                className="min-h-11"
                                inputMode="numeric"
                                placeholder={
                                  aiHoursPlaceholder !== null
                                    ? String(aiHoursPlaceholder)
                                    : "Horas"
                                }
                                value={
                                  state.valuedHours === null
                                    ? ""
                                    : String(state.valuedHours)
                                }
                                disabled={isReviewed}
                                onKeyDown={(event) => {
                                  if (
                                    event.key === "e" ||
                                    event.key === "E" ||
                                    event.key === "+" ||
                                    event.key === "-"
                                  ) {
                                    event.preventDefault();
                                  }
                                }}
                                onChange={(event) => {
                                  if (isReviewed) return;
                                  const value = event.target.value;
                                  const parsed = Number(value);
                                  updateFileState(file.id, (prev) => ({
                                    ...prev,
                                    valuedHours:
                                      value.trim().length === 0
                                        ? null
                                        : Number.isFinite(parsed)
                                          ? parsed
                                          : null,
                                  }));
                                }}
                              />
                            </div>
                          </div>

                          <div
                            className={cn(
                              "grid overflow-hidden transition-all duration-300 ease-out",
                              isDenied
                                ? "grid-rows-[1fr] opacity-100"
                                : "pointer-events-none grid-rows-[0fr] opacity-0",
                            )}
                          >
                            <div className="min-h-0">
                              <div className="grid gap-2">
                                <label className="text-sm font-medium">
                                  Comentario (obrigatorio se negar)
                                </label>
                                <textarea
                                  className="min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                                  disabled={isReviewed || !isDenied}
                                  placeholder={
                                    !isReviewed &&
                                    getAiFeedbackPlaceholder(file)
                                      ? (getAiFeedbackPlaceholder(file) ?? "")
                                      : "Explique o motivo da negacao..."
                                  }
                                  value={state.commentary}
                                  onChange={(event) => {
                                    if (isReviewed) return;
                                    updateFileState(file.id, (prev) => ({
                                      ...prev,
                                      commentary: event.target.value,
                                    }));
                                  }}
                                />
                              </div>
                            </div>
                          </div>

                          <div className="flex w-full justify-end border-t pt-4">
                            <Button
                              size="sm"
                              intent="primary"
                              disabled={isSaving || isReviewed}
                              onClick={() => handleSubmitReview(file)}
                              className="min-h-11 w-full gap-2 sm:w-auto sm:min-w-40"
                            >
                              {isSaving ? (
                                <>
                                  <LoaderCircle className="h-4 w-4 animate-spin" />
                                  Salvando...
                                </>
                              ) : isReviewed ? (
                                <>
                                  <Save className="h-4 w-4" />
                                  Revisado
                                </>
                              ) : (
                                <>
                                  <Save className="h-4 w-4" />
                                  Salvar
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
              </Accordion>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
