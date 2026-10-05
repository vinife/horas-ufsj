"use client";

import * as React from "react";
import {
  Building2,
  Mail,
  MessageSquareWarning,
  Save,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ds/button";
import { FileViewer } from "@/components/ds/file-viewer";
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
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type AdminExtensionCertificatePayload = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  hours: number | null;
  feedback: string | null;
  createdAt: string;
};

export type AdminExtensionProjectPayload = {
  id: string;
  userId: string;
  name: string | null;
  email: string;
  title: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coordinatorInstitution: string;
  workPlan: string;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "COMPLETED";
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
  certificate: AdminExtensionCertificatePayload | null;
};

export type AdminExtensionStudentRow = {
  userId: string;
  name: string | null;
  email: string;
  projects: AdminExtensionProjectPayload[];
};

type ExtensionAdminDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student: AdminExtensionStudentRow | null;
  onMutated?: () => Promise<void> | void;
  onStudentUpdate?: (student: AdminExtensionStudentRow) => void;
};

type ReviewState = {
  decision: "allow" | "deny" | null;
  commentary: string;
  hours: string;
};

const EMPTY_REVIEW_STATE: ReviewState = {
  decision: null,
  commentary: "",
  hours: "",
};

function formatDate(input: string) {
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
}

function formatProjectStatus(status: AdminExtensionProjectPayload["status"]) {
  switch (status) {
    case "PENDING":
      return { label: "Pendente", variant: "pending" as const };
    case "ACTIVE":
      return { label: "Ativo", variant: "active" as const };
    case "REJECTED":
      return { label: "Rejeitado", variant: "denied" as const };
    case "COMPLETED":
      return { label: "Concluído", variant: "secondary" as const };
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

function getTriggerLabel(project: AdminExtensionProjectPayload) {
  const status = formatProjectStatus(project.status);
  return `${project.title} (${formatDate(project.createdAt)}) — ${status.label}`;
}

export function ExtensionAdminDialog({
  open,
  onOpenChange,
  student,
  onMutated,
  onStudentUpdate,
}: ExtensionAdminDialogProps) {
  const [openProjectId, setOpenProjectId] = React.useState<string | null>(
    null,
  );
  const [reviewState, setReviewState] =
    React.useState<ReviewState>(EMPTY_REVIEW_STATE);
  const [isSaving, setIsSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setOpenProjectId(null);
      setReviewState(EMPTY_REVIEW_STATE);
    }
  }, [open]);

  React.useEffect(() => {
    setReviewState(EMPTY_REVIEW_STATE);
  }, [openProjectId]);

  const updateStudentProject = (updated: AdminExtensionProjectPayload) => {
    if (!student) return;
    onStudentUpdate?.({
      ...student,
      projects: student.projects.map((project) =>
        project.id === updated.id ? updated : project,
      ),
    });
  };

  const handleReviewProposal = async (project: AdminExtensionProjectPayload) => {
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
        "Adicione uma justificativa quando a proposta for negada.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/admin/extensions/${project.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          decision: reviewState.decision,
          commentary: commentary || undefined,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        project?: AdminExtensionProjectPayload;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Falha ao salvar avaliação.");
      }
      if (data?.project) updateStudentProject(data.project);
      setReviewState(EMPTY_REVIEW_STATE);
      notify.success(
        reviewState.decision === "allow"
          ? "Proposta aprovada"
          : "Proposta rejeitada",
        "A avaliação foi salva com sucesso.",
      );
      await onMutated?.();
    } catch (error) {
      notify.error(
        "Falha ao salvar avaliação",
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReviewCertificate = async (
    project: AdminExtensionProjectPayload,
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
        "Adicione uma justificativa quando o certificado for negado.",
      );
      return;
    }
    const hours = Number(reviewState.hours);
    if (
      reviewState.decision === "allow" &&
      (!Number.isFinite(hours) || !Number.isInteger(hours) || hours < 0)
    ) {
      notify.warning(
        "Horas inválidas",
        "Informe um número inteiro de horas maior ou igual a zero.",
      );
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(
        `/api/admin/extensions/${project.id}/certificate`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: reviewState.decision,
            hours: reviewState.decision === "allow" ? hours : 0,
            commentary: commentary || undefined,
          }),
        },
      );
      const data = (await res.json().catch(() => null)) as {
        project?: AdminExtensionProjectPayload;
        error?: string;
      } | null;
      if (!res.ok) {
        throw new Error(data?.error ?? "Falha ao salvar avaliação.");
      }
      if (data?.project) updateStudentProject(data.project);
      setReviewState(EMPTY_REVIEW_STATE);
      notify.success(
        reviewState.decision === "allow"
          ? "Certificado aprovado"
          : "Certificado rejeitado",
        "A avaliação foi salva com sucesso.",
      );
      await onMutated?.();
    } catch (error) {
      notify.error(
        "Falha ao salvar avaliação",
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {student?.name ?? "Aluno"}{" "}
            <span className="text-muted-foreground">
              ({student?.email ?? "-"})
            </span>
          </DialogTitle>
          <DialogDescription>
            Projetos de extensão cadastrados por este aluno.
          </DialogDescription>
        </DialogHeader>

        {!student || student.projects.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            Nenhum projeto cadastrado.
          </div>
        ) : (
          <Accordion
            type="single"
            collapsible
            value={openProjectId ?? ""}
            onValueChange={(value) => setOpenProjectId(value || null)}
          >
            {student.projects.map((project) => {
              const status = formatProjectStatus(project.status);
              const isDenied = reviewState.decision === "deny";
              const needsProposalDecision = project.status === "PENDING";
              const needsCertificateDecision =
                project.status === "ACTIVE" &&
                project.certificate?.status === "PENDING";

              return (
                <AccordionItem key={project.id} value={project.id}>
                  <AccordionTrigger>
                    <div className="flex w-full flex-wrap items-center justify-between gap-2">
                      <span className="min-w-0 truncate font-medium">
                        {getTriggerLabel(project)}
                      </span>
                      <Badge variant={status.variant}>{status.label}</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-4 pt-2">
                      <div
                        className={cn(
                          "grid gap-4",
                          needsCertificateDecision &&
                            "lg:grid-cols-[minmax(0,1fr)_16rem] lg:items-start lg:gap-3 lg:min-h-104",
                        )}
                      >
                        <div className="grid gap-4">
                          <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
                            <InfoRow
                              icon={Building2}
                              label="Coordenador"
                              value={`${project.coordinatorName} · ${project.coordinatorInstitution}`}
                            />
                            <InfoRow
                              icon={Mail}
                              label="Email do coordenador"
                              value={project.coordinatorEmail}
                            />
                            <InfoRow
                              icon={MessageSquareWarning}
                              label="Plano de trabalho"
                              value={project.workPlan}
                            />
                          </div>

                          {needsProposalDecision ? (
                            <>
                              <div className="grid gap-2">
                                <span className="text-sm font-medium">
                                  Decisão da proposta
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
                          ) : null}

                          {needsCertificateDecision ? (
                            <>
                              <div className="grid gap-2">
                                <span className="text-sm font-medium">
                                  Decisão do certificado
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

                              {reviewState.decision === "allow" ? (
                                <div className="grid gap-2">
                                  <label className="text-sm font-medium">
                                    Horas concedidas
                                  </label>
                                  <Input
                                    type="number"
                                    min={0}
                                    inputMode="numeric"
                                    className="min-h-11 w-32"
                                    value={reviewState.hours}
                                    onChange={(event) =>
                                      setReviewState((prev) => ({
                                        ...prev,
                                        hours: event.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              ) : null}

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
                          ) : null}

                          {!needsProposalDecision &&
                          !needsCertificateDecision &&
                          project.status === "REJECTED" &&
                          project.feedback ? (
                            <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                              <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>{project.feedback}</span>
                            </div>
                          ) : null}

                          {!needsProposalDecision &&
                          !needsCertificateDecision &&
                          project.certificate?.status === "REJECTED" &&
                          project.certificate.feedback ? (
                            <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                              <MessageSquareWarning className="mt-0.5 h-4 w-4 shrink-0" />
                              <span>
                                Certificado rejeitado: {project.certificate.feedback}
                              </span>
                            </div>
                          ) : null}

                          {project.status === "COMPLETED" &&
                          project.certificate?.hours != null ? (
                            <div className="text-sm text-muted-foreground">
                              {project.certificate.hours}h de extensão
                              concedidas.
                            </div>
                          ) : null}

                          {project.status === "ACTIVE" && !project.certificate ? (
                            <div className="text-sm text-muted-foreground">
                              Aguardando o envio do certificado pelo aluno.
                            </div>
                          ) : null}
                        </div>

                        {needsCertificateDecision ? (
                          <FileViewer
                            fileUrl={`/api/files/certificate/${project.certificate?.id}`}
                            fileName={`Certificado - ${project.title}`}
                            className="h-80 lg:h-full"
                          />
                        ) : null}
                      </div>

                      {needsProposalDecision || needsCertificateDecision ? (
                        <div className="flex w-full justify-end border-t pt-4">
                          <Button
                            type="button"
                            size="sm"
                            intent="primary"
                            disabled={isSaving || reviewState.decision === null}
                            onClick={() =>
                              needsProposalDecision
                                ? handleReviewProposal(project)
                                : handleReviewCertificate(project)
                            }
                            className="min-h-11 w-full gap-2 sm:w-auto sm:min-w-32"
                          >
                            {isSaving ? (
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
