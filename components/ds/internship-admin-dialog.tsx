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
import type { InternshipSubmissionPayload } from "@/components/ds/internshipcard";
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
  onFinalize?: (payload: {
    status: "COMPLETED" | "TERMINATED";
  }) => Promise<void>;
};

type SubmissionReviewState = {
  decision: "allow" | "deny" | null;
  commentary: string;
};

const EMPTY_REVIEW_STATE: SubmissionReviewState = {
  decision: null,
  commentary: "",
};

function formatDate(input: string) {
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
}

function formatSubmissionStatus(
  status: InternshipSubmissionPayload["status"],
) {
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

export function InternshipAdminDialog({
  open,
  onOpenChange,
  internship,
  onReviewSubmission,
  onFinalize,
}: InternshipAdminDialogProps) {
  const [openSubmissionId, setOpenSubmissionId] = React.useState<
    string | null
  >(null);
  const [renderedSubmissionId, setRenderedSubmissionId] = React.useState<
    string | null
  >(null);
  const closeTimeoutRef = React.useRef<number | null>(null);
  const [reviewState, setReviewState] =
    React.useState<SubmissionReviewState>(EMPTY_REVIEW_STATE);
  const [isSavingReview, setIsSavingReview] = React.useState(false);
  const [isFinalizing, setIsFinalizing] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setOpenSubmissionId(null);
      setRenderedSubmissionId(null);
      setReviewState(EMPTY_REVIEW_STATE);
    }
  }, [open]);

  React.useEffect(() => {
    setReviewState(EMPTY_REVIEW_STATE);
  }, [internship?.id]);

  // Keeps the FileViewer (and the two-column split layout) mounted for the
  // whole accordion-close animation instead of yanking it out the instant
  // the trigger is clicked — unmounting it synchronously with the click
  // shrinks the panel's measured height mid-animation, which confuses
  // Radix's animationend-based Presence tracking and used to require a
  // second click to actually finish closing.
  React.useEffect(() => {
    if (openSubmissionId) {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
      setRenderedSubmissionId(openSubmissionId);
    } else if (renderedSubmissionId !== null) {
      closeTimeoutRef.current = window.setTimeout(() => {
        setRenderedSubmissionId(null);
        closeTimeoutRef.current = null;
      }, 250);
    }

    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openSubmissionId]);

  const handleReviewSubmit = async (
    submission: InternshipSubmissionPayload,
  ) => {
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
        "Adicione uma justificativa quando o período for negado.",
      );
      return;
    }

    setIsSavingReview(true);
    try {
      await onReviewSubmission?.({
        submissionId: submission.id,
        decision: reviewState.decision,
        commentary: commentary || undefined,
      });
      setReviewState(EMPTY_REVIEW_STATE);
      notify.success(
        reviewState.decision === "allow"
          ? "Período aprovado"
          : "Período rejeitado",
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

        {!internship || internship.submissions.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            Nenhuma submissão registrada.
          </div>
        ) : (
          <Accordion
            type="single"
            collapsible
            value={openSubmissionId ?? ""}
            onValueChange={(value) => setOpenSubmissionId(value || null)}
          >
            {internship.submissions.map((submission) => {
              const status = formatSubmissionStatus(submission.status);
              const isPending = submission.status === "PENDING";
              const isOpen = renderedSubmissionId === submission.id;
              const isDenied = reviewState.decision === "deny";

              return (
                <AccordionItem key={submission.id} value={submission.id}>
                  <AccordionTrigger>
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">
                        {getSubmissionTriggerLabel(submission)}
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
                        {isPending ? (
                          <>
                            {submission.kind === "EXTENSION" && internship ? (
                              <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
                                <InfoRow
                                  icon={CalendarCheck}
                                  label="Período aprovado atual"
                                  value={`${internship.company} · ${formatDate(internship.start)}–${formatDate(internship.end)}`}
                                />
                                <InfoRow
                                  icon={CalendarClock}
                                  label="Proposto"
                                  value={`${submission.company} · ${formatDate(submission.start)}–${formatDate(submission.end)}`}
                                />
                              </div>
                            ) : (
                              <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
                                <InfoRow
                                  icon={Building2}
                                  label="Empresa"
                                  value={submission.company}
                                />
                                <InfoRow
                                  icon={User}
                                  label="Supervisor"
                                  value={submission.supervisor}
                                />
                                <InfoRow
                                  icon={CalendarRange}
                                  label="Período"
                                  value={`${formatDate(submission.start)}–${formatDate(submission.end)}`}
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
                              value={submission.company}
                            />
                            <InfoRow
                              icon={User}
                              label="Supervisor"
                              value={submission.supervisor}
                            />
                            <InfoRow
                              icon={CalendarRange}
                              label="Período"
                              value={`${formatDate(submission.start)}–${formatDate(submission.end)}`}
                            />
                            {submission.status === "REJECTED" &&
                            submission.feedback ? (
                              <InfoRow
                                icon={MessageSquareWarning}
                                label="Justificativa"
                                value={submission.feedback}
                              />
                            ) : null}
                          </div>
                        )}
                      </div>

                      {isOpen ? (
                        <FileViewer
                          fileUrl={`/api/files/internship-submission/${submission.id}`}
                          fileName={`${internship?.company ?? ""} - ${submission.kind}`}
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
                          onClick={() => handleReviewSubmit(submission)}
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
