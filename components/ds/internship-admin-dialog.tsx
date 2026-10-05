"use client";

import * as React from "react";
import {
  Ban,
  Building2,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  CheckCircle2,
  type LucideIcon,
  MessageSquareWarning,
  Save,
  User,
} from "lucide-react";
import { Button } from "@/components/ds/button";
import { FileViewer } from "@/components/ds/file-viewer";
import { notify } from "@/components/ds/notification";
import type {
  InternshipDocumentPayload,
  InternshipSubmissionPayload,
} from "@/components/ds/internshipcard";
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
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type AdminInternshipRow = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  status: "PENDING" | "REJECTED" | "ACTIVE" | "COMPLETED" | "TERMINATED";
  company: string;
  supervisor: string;
  start: string;
  end: string;
  feedback: string | null;
  submissions: InternshipSubmissionPayload[];
  documents: InternshipDocumentPayload[];
  certificate: { hours: number | null } | null;
};

type InternshipAdminDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  internship: AdminInternshipRow | null;
  onReviewSubmission?: (payload: {
    submissionId: string;
    decision: "allow" | "deny";
    commentary?: string;
  }) => Promise<void>;
  onReviewDocument?: (payload: {
    documentId: string;
    decision: "allow" | "deny";
    commentary?: string;
  }) => Promise<void>;
  onFinalize?: (payload: {
    status: "COMPLETED" | "TERMINATED";
  }) => Promise<void>;
  onSetHours?: (payload: { hours: number }) => Promise<void>;
};

type ReviewState = {
  decision: "allow" | "deny" | null;
  commentary: string;
};

const EMPTY_REVIEW_STATE: ReviewState = {
  decision: null,
  commentary: "",
};

type AccordionEntry =
  | { type: "submission"; id: string; createdAt: string; data: InternshipSubmissionPayload }
  | { type: "document"; id: string; createdAt: string; data: InternshipDocumentPayload };

function formatDate(input: string) {
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
}

function formatEntryStatus(status: "PENDING" | "APPROVED" | "REJECTED") {
  switch (status) {
    case "APPROVED":
      return { label: "Aprovado", variant: "approved" as const };
    case "REJECTED":
      return { label: "Rejeitado", variant: "denied" as const };
    default:
      return { label: "Pendente", variant: "pending" as const };
  }
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="grid gap-0.5 text-sm">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="font-medium text-foreground">{value}</span>
      </div>
    </div>
  );
}

function getSubmissionTriggerLabel(submission: InternshipSubmissionPayload) {
  const period = `${formatDate(submission.start)} – ${formatDate(submission.end)}`;
  const kindLabel = submission.kind === "EXTENSION" ? "Aditivo" : "Período inicial";

  if (submission.status === "APPROVED") {
    return `${kindLabel} aprovado (${period})`;
  }
  if (submission.status === "REJECTED") {
    return `${kindLabel} rejeitado (${period})`;
  }
  return `${kindLabel} proposto (${period})`;
}

const DOCUMENT_KIND_LABELS: Record<InternshipDocumentPayload["kind"], string> = {
  PARTIAL_REPORT: "Relatório parcial",
  COMPLETION_TERM: "Termo de Realização do Estágio",
  FINAL_REPORT: "Relatório final",
  TERMINATION_TERM: "Termo de Rescisão",
};

function getDocumentTriggerLabel(document: InternshipDocumentPayload) {
  const kindLabel = DOCUMENT_KIND_LABELS[document.kind];
  const date = formatDate(document.createdAt);

  if (document.status === "APPROVED") {
    return `${kindLabel} aprovado (${date})`;
  }
  if (document.status === "REJECTED") {
    return `${kindLabel} rejeitado (${date})`;
  }
  return `${kindLabel} enviado (${date})`;
}

export function InternshipAdminDialog({
  open,
  onOpenChange,
  internship,
  onReviewSubmission,
  onReviewDocument,
  onFinalize,
  onSetHours,
}: InternshipAdminDialogProps) {
  const [openEntryId, setOpenEntryId] = React.useState<string | null>(null);
  const [renderedEntryId, setRenderedEntryId] = React.useState<string | null>(
    null,
  );
  const closeTimeoutRef = React.useRef<number | null>(null);
  const [reviewState, setReviewState] =
    React.useState<ReviewState>(EMPTY_REVIEW_STATE);
  const [isSavingReview, setIsSavingReview] = React.useState(false);
  const [isFinalizing, setIsFinalizing] = React.useState(false);
  const [hoursInput, setHoursInput] = React.useState("");
  const [isSavingHours, setIsSavingHours] = React.useState(false);

  const entries = React.useMemo<AccordionEntry[]>(() => {
    if (!internship) return [];
    const submissionEntries: AccordionEntry[] = internship.submissions.map(
      (submission) => ({
        type: "submission",
        id: submission.id,
        createdAt: submission.createdAt,
        data: submission,
      }),
    );
    const documentEntries: AccordionEntry[] = internship.documents.map(
      (document) => ({
        type: "document",
        id: document.id,
        createdAt: document.createdAt,
        data: document,
      }),
    );
    return [...submissionEntries, ...documentEntries].sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
  }, [internship]);

  React.useEffect(() => {
    if (!open) {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setOpenEntryId(null);
      setRenderedEntryId(null);
      setReviewState(EMPTY_REVIEW_STATE);
    }
  }, [open]);

  React.useEffect(() => {
    setReviewState(EMPTY_REVIEW_STATE);
  }, [internship?.id]);

  React.useEffect(() => {
    setHoursInput(
      internship?.certificate?.hours != null
        ? String(internship.certificate.hours)
        : "",
    );
  }, [internship?.id, internship?.certificate?.hours]);

  // Keeps the FileViewer (and the two-column split layout) mounted for the
  // whole accordion-close animation instead of yanking it out the instant
  // the trigger is clicked — unmounting it synchronously with the click
  // shrinks the panel's measured height mid-animation, which confuses
  // Radix's animationend-based Presence tracking and used to require a
  // second click to actually finish closing.
  React.useEffect(() => {
    if (openEntryId) {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setRenderedEntryId(openEntryId);
    } else if (renderedEntryId !== null) {
      closeTimeoutRef.current = window.setTimeout(() => {
        setRenderedEntryId(null);
        closeTimeoutRef.current = null;
      }, 250);
    }

    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEntryId]);

  const handleReviewSave = async (entry: AccordionEntry) => {
    if (reviewState.decision === null) {
      notify.warning(
        "Decisão obrigatória",
        "Selecione Aprovar ou Negar antes de salvar.",
      );
      return;
    }

    const commentary = reviewState.commentary.trim();

    if (reviewState.decision === "deny" && !commentary) {
      notify.warning(
        "Justificativa obrigatória",
        "Adicione uma justificativa quando o item for negado.",
      );
      return;
    }

    setIsSavingReview(true);
    try {
      if (entry.type === "submission") {
        await onReviewSubmission?.({
          submissionId: entry.id,
          decision: reviewState.decision,
          commentary: commentary || undefined,
        });
      } else {
        await onReviewDocument?.({
          documentId: entry.id,
          decision: reviewState.decision,
          commentary: commentary || undefined,
        });
      }
      setReviewState(EMPTY_REVIEW_STATE);
      notify.success(
        reviewState.decision === "allow" ? "Item aprovado" : "Item rejeitado",
        "A avaliação foi salva com sucesso.",
      );
    } catch (error) {
      notify.error(
        "Falha ao salvar avaliação",
        error instanceof Error
          ? error.message
          : "Não foi possível salvar a avaliação.",
      );
    } finally {
      setIsSavingReview(false);
    }
  };

  const handleFinalize = async (status: "COMPLETED" | "TERMINATED") => {
    const confirmMessage =
      status === "COMPLETED"
        ? "Confirma marcar este estágio como concluído?"
        : "Confirma encerrar este estágio?";

    if (!window.confirm(confirmMessage)) return;

    setIsFinalizing(true);
    try {
      await onFinalize?.({ status });
      notify.success(
        status === "COMPLETED" ? "Estágio concluído" : "Estágio encerrado",
        "O status do estágio foi atualizado com sucesso.",
      );
    } catch (error) {
      notify.error(
        "Falha ao atualizar estágio",
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o status do estágio.",
      );
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleSaveHours = async () => {
    const hours = Number(hoursInput);
    if (!Number.isFinite(hours) || !Number.isInteger(hours) || hours < 0) {
      notify.warning(
        "Valor inválido",
        "Informe um número inteiro de horas maior ou igual a zero.",
      );
      return;
    }

    setIsSavingHours(true);
    try {
      await onSetHours?.({ hours });
      notify.success(
        "Horas salvas",
        "As horas complementares do estágio foram atualizadas.",
      );
    } catch (error) {
      notify.error(
        "Falha ao salvar horas",
        error instanceof Error
          ? error.message
          : "Não foi possível salvar as horas.",
      );
    } finally {
      setIsSavingHours(false);
    }
  };

  const isFinalized =
    internship?.status === "COMPLETED" || internship?.status === "TERMINATED";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {internship?.name ?? "Aluno"}{" "}
            <span className="text-muted-foreground">
              ({internship?.email ?? "-"})
            </span>
          </DialogTitle>
          <DialogDescription>
            Estágio na empresa {internship?.company ?? "-"}
          </DialogDescription>
        </DialogHeader>

        {internship?.status === "ACTIVE" ? (
          <div className="flex flex-wrap gap-2 border-b pb-4">
            <Button
              type="button"
              intent="secondary"
              size="sm"
              disabled={isFinalizing}
              onClick={() => handleFinalize("COMPLETED")}
            >
              <CheckCircle2 className="h-4 w-4" />
              Marcar como concluído
            </Button>
            <Button
              type="button"
              intent="danger"
              size="sm"
              disabled={isFinalizing}
              onClick={() => handleFinalize("TERMINATED")}
            >
              <Ban className="h-4 w-4" />
              Encerrar estágio
            </Button>
          </div>
        ) : null}

        {internship && isFinalized ? (
          <div className="grid gap-2 border-b pb-4">
            <label className="text-sm font-medium">
              Horas complementares concedidas
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                className="min-h-11 w-32"
                value={hoursInput}
                onChange={(event) => setHoursInput(event.target.value)}
              />
              <Button
                type="button"
                size="sm"
                intent="primary"
                disabled={isSavingHours}
                onClick={handleSaveHours}
                className="min-h-11 gap-2"
              >
                {isSavingHours ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salvar horas
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {!internship || entries.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            Nenhuma submissão registrada.
          </div>
        ) : (
          <Accordion
            type="single"
            collapsible
            value={openEntryId ?? ""}
            onValueChange={(value) => setOpenEntryId(value || null)}
          >
            {entries.map((entry) => {
              const status = formatEntryStatus(entry.data.status);
              const isPending = entry.data.status === "PENDING";
              const isOpen = renderedEntryId === entry.id;
              const isDenied = reviewState.decision === "deny";
              const fileUrl =
                entry.type === "submission"
                  ? `/api/files/internship-submission/${entry.id}`
                  : `/api/files/internship-document/${entry.id}`;
              const fileName =
                entry.type === "submission"
                  ? `${internship?.company ?? ""} - ${entry.data.kind}`
                  : DOCUMENT_KIND_LABELS[entry.data.kind];

              return (
                <AccordionItem key={entry.id} value={entry.id}>
                  <AccordionTrigger>
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">
                        {entry.type === "submission"
                          ? getSubmissionTriggerLabel(entry.data)
                          : getDocumentTriggerLabel(entry.data)}
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-4 pt-2">
                    <div
                      className={cn(
                        "grid gap-4",
                        isOpen &&
                          "lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-3 lg:min-h-104",
                      )}
                    >
                      <div className="grid gap-4">
                        {entry.type === "submission" ? (
                          isPending ? (
                            <>
                              {entry.data.kind === "EXTENSION" && internship ? (
                                <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
                                  <InfoRow
                                    icon={CalendarCheck}
                                    label="Período aprovado atual"
                                    value={`${internship.company} · ${formatDate(internship.start)}–${formatDate(internship.end)}`}
                                  />
                                  <InfoRow
                                    icon={CalendarClock}
                                    label="Proposto"
                                    value={`${entry.data.company} · ${formatDate(entry.data.start)}–${formatDate(entry.data.end)}`}
                                  />
                                </div>
                              ) : (
                                <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
                                  <InfoRow
                                    icon={Building2}
                                    label="Empresa"
                                    value={entry.data.company}
                                  />
                                  <InfoRow
                                    icon={User}
                                    label="Supervisor"
                                    value={entry.data.supervisor}
                                  />
                                  <InfoRow
                                    icon={CalendarRange}
                                    label="Período"
                                    value={`${formatDate(entry.data.start)}–${formatDate(entry.data.end)}`}
                                  />
                                </div>
                              )}

                              <div className="grid gap-2">
                                <span className="text-sm font-medium">
                                  Decisão
                                </span>
                                <RadioGroup
                                  value={reviewState.decision ?? undefined}
                                  onValueChange={(value) => {
                                    if (value !== "allow" && value !== "deny")
                                      return;
                                    setReviewState((prev) => ({
                                      ...prev,
                                      decision: value,
                                      commentary:
                                        value === "deny" ? prev.commentary : "",
                                    }));
                                  }}
                                  className="grid grid-cols-2 gap-2 sm:gap-3"
                                >
                                  <label className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                    <RadioGroupItem value="allow" />
                                    Aprovar
                                  </label>
                                  <label className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                    <RadioGroupItem value="deny" />
                                    Negar
                                  </label>
                                </RadioGroup>
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
                                      Comentário (obrigatório se negar)
                                    </label>
                                    <Textarea
                                      disabled={!isDenied}
                                      placeholder="Explique o motivo da negação..."
                                      value={reviewState.commentary}
                                      onChange={(event) =>
                                        setReviewState((prev) => ({
                                          ...prev,
                                          commentary: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                </div>
                              </div>
                            </>
                          ) : (
                            <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
                              <InfoRow
                                icon={Building2}
                                label="Empresa"
                                value={entry.data.company}
                              />
                              <InfoRow
                                icon={User}
                                label="Supervisor"
                                value={entry.data.supervisor}
                              />
                              <InfoRow
                                icon={CalendarRange}
                                label="Período"
                                value={`${formatDate(entry.data.start)}–${formatDate(entry.data.end)}`}
                              />
                              {entry.data.status === "REJECTED" &&
                              entry.data.feedback ? (
                                <InfoRow
                                  icon={MessageSquareWarning}
                                  label="Justificativa"
                                  value={entry.data.feedback}
                                />
                              ) : null}
                            </div>
                          )
                        ) : isPending ? (
                          <>
                            <div className="grid gap-2">
                              <span className="text-sm font-medium">
                                Decisão
                              </span>
                              <RadioGroup
                                value={reviewState.decision ?? undefined}
                                onValueChange={(value) => {
                                  if (value !== "allow" && value !== "deny")
                                    return;
                                  setReviewState((prev) => ({
                                    ...prev,
                                    decision: value,
                                    commentary:
                                      value === "deny" ? prev.commentary : "",
                                  }));
                                }}
                                className="grid grid-cols-2 gap-2 sm:gap-3"
                              >
                                <label className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                  <RadioGroupItem value="allow" />
                                  Aprovar
                                </label>
                                <label className="flex min-h-11 items-center gap-2 rounded-md border px-3 py-2 text-sm">
                                  <RadioGroupItem value="deny" />
                                  Negar
                                </label>
                              </RadioGroup>
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
                                    Comentário (obrigatório se negar)
                                  </label>
                                  <Textarea
                                    disabled={!isDenied}
                                    placeholder="Explique o motivo da negação..."
                                    value={reviewState.commentary}
                                    onChange={(event) =>
                                      setReviewState((prev) => ({
                                        ...prev,
                                        commentary: event.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          </>
                        ) : entry.data.status === "REJECTED" &&
                          entry.data.feedback ? (
                          <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                            <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" />
                            <span>{entry.data.feedback}</span>
                          </div>
                        ) : null}
                      </div>

                      {isOpen ? (
                        <FileViewer
                          fileUrl={fileUrl}
                          fileName={fileName}
                          className="h-80 lg:h-full"
                        />
                      ) : null}
                    </div>

                    {isPending ? (
                      <div className="flex w-full justify-end border-t pt-4">
                        <Button
                          type="button"
                          size="sm"
                          intent="primary"
                          disabled={
                            isSavingReview || reviewState.decision === null
                          }
                          onClick={() => handleReviewSave(entry)}
                          className="min-h-11 w-full gap-2 sm:w-auto sm:min-w-32"
                        >
                          {isSavingReview ? (
                            <>
                              <Spinner className="h-4 w-4" />
                              Salvando...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4" />
                              Salvar
                            </>
                          )}
                        </Button>
                      </div>
                    ) : null}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </DialogContent>
    </Dialog>
  );
}
