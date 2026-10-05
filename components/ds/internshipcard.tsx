"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ds/card";
import { Button } from "@/components/ds/button";
import { notify } from "@/components/ds/notification";
import { InternshipFormDialog } from "@/components/ds/internship-form-dialog";
import {
  InternshipDocumentUploadDialog,
  type InternshipDocumentKind,
} from "@/components/ds/internship-document-upload-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type InternshipSubmissionPayload = {
  id: string;
  kind: "INITIAL" | "EXTENSION";
  company: string;
  supervisor: string;
  start: string;
  end: string;
  fileUrl: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  feedback: string | null;
  createdAt: string;
};

export type InternshipDocumentPayload = {
  id: string;
  kind: InternshipDocumentKind;
  status: "PENDING" | "APPROVED" | "REJECTED";
  feedback: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type InternshipPayload = {
  id: string;
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

const DOCUMENT_KIND_ORDER: InternshipDocumentKind[] = [
  "PARTIAL_REPORT",
  "COMPLETION_TERM",
  "FINAL_REPORT",
  "TERMINATION_TERM",
];

const DOCUMENT_KIND_LABELS: Record<InternshipDocumentKind, string> = {
  PARTIAL_REPORT: "Relatório parcial",
  COMPLETION_TERM: "Termo de Realização do Estágio",
  FINAL_REPORT: "Relatório final",
  TERMINATION_TERM: "Termo de Rescisão",
};

const DOCUMENT_KIND_GROUP_LABELS: Record<InternshipDocumentKind, string> = {
  PARTIAL_REPORT: "Relatórios parciais",
  COMPLETION_TERM: "Termo de realização",
  FINAL_REPORT: "Relatório final",
  TERMINATION_TERM: "Termo de rescisão",
};

const DOCUMENT_KIND_ACTION_LABELS: Record<InternshipDocumentKind, string> = {
  PARTIAL_REPORT: "Enviar relatório parcial",
  COMPLETION_TERM: "Enviar termo de realização",
  FINAL_REPORT: "Enviar relatório final",
  TERMINATION_TERM: "Enviar termo de rescisão",
};

function getEligibleDocumentKinds(
  status: InternshipPayload["status"],
): InternshipDocumentKind[] {
  return DOCUMENT_KIND_ORDER.filter((kind) => {
    if (kind === "PARTIAL_REPORT") return status === "ACTIVE";
    if (kind === "TERMINATION_TERM") return status === "TERMINATED";
    return status === "COMPLETED" || status === "TERMINATED";
  });
}

type InternshipCardProps = {
  title?: string;
  endpoint?: string;
  className?: string;
};

type FormDialogMode = "create" | "edit" | "extend";

async function fetchInternship(
  endpoint: string,
): Promise<InternshipPayload | null> {
  const res = await fetch(endpoint, { credentials: "include" });
  if (!res.ok) {
    throw new Error("Failed to fetch internship");
  }
  const data = (await res.json()) as { internship: InternshipPayload | null };
  return data.internship ?? null;
}

function formatDate(input: string) {
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
}

function ExtensionSubitems({
  submissions,
}: {
  submissions: InternshipSubmissionPayload[];
}) {
  const extensions = submissions.filter((s) => s.kind === "EXTENSION");
  const approvedExtensions = extensions.filter((s) => s.status === "APPROVED");
  const latestExtension = extensions.at(-1) ?? null;
  const showLatestExtension =
    latestExtension !== null && latestExtension.status !== "APPROVED";

  if (approvedExtensions.length === 0 && !showLatestExtension) {
    return null;
  }

  return (
    <div className="grid gap-2 border-l-2 pl-4">
      {approvedExtensions.map((submission) => (
        <div
          key={submission.id}
          className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
        >
          <Badge variant="approved">Aditivo aprovado</Badge>
          <span>
            {formatDate(submission.start)} – {formatDate(submission.end)}
          </span>
        </div>
      ))}

      {showLatestExtension && latestExtension ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {latestExtension.status === "REJECTED" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="denied">Aditivo rejeitado</Badge>
              </TooltipTrigger>
              <TooltipContent>
                {latestExtension.feedback?.trim() ||
                  "Nenhuma justificativa informada."}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Badge variant="pending">Aditivo em análise</Badge>
          )}
          <span>
            {formatDate(latestExtension.start)} –{" "}
            {formatDate(latestExtension.end)}
          </span>
        </div>
      ) : null}
    </div>
  );
}

function DocumentSubitems({
  documents,
}: {
  documents: InternshipDocumentPayload[];
}) {
  const groups = DOCUMENT_KIND_ORDER.map((kind) => ({
    kind,
    items: documents.filter((document) => document.kind === kind),
  })).filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 border-l-2 pl-4">
      {groups.map((group) => (
        <div key={group.kind} className="grid gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">
            {DOCUMENT_KIND_GROUP_LABELS[group.kind]}
          </p>
          {group.items.map((document) => (
            <div
              key={document.id}
              className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"
            >
              {document.status === "REJECTED" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="denied">Rejeitado</Badge>
                  </TooltipTrigger>
                  <TooltipContent>
                    {document.feedback?.trim() ||
                      "Nenhuma justificativa informada."}
                  </TooltipContent>
                </Tooltip>
              ) : document.status === "APPROVED" ? (
                <Badge variant="approved">Aprovado</Badge>
              ) : (
                <Badge variant="pending">Pendente</Badge>
              )}
              <span>{formatDate(document.createdAt)}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function formatStatus(status: InternshipPayload["status"]) {
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

export function InternshipCard({
  title = "Estágio",
  endpoint = "/api/student/internship",
  className,
}: InternshipCardProps) {
  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => ["internship", endpoint], [endpoint]);
  const hasShownLoadErrorRef = React.useRef(false);

  const [isDialogOpen, setIsDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<FormDialogMode>("create");
  const [documentDialogKind, setDocumentDialogKind] =
    React.useState<InternshipDocumentKind | null>(null);

  const { data: internship, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchInternship(endpoint),
  });

  React.useEffect(() => {
    if (!isError) {
      hasShownLoadErrorRef.current = false;
      return;
    }

    if (hasShownLoadErrorRef.current) return;
    notify.error(
      "Falha ao carregar estágio",
      "Não foi possível carregar as informações do estágio.",
    );
    hasShownLoadErrorRef.current = true;
  }, [isError]);

  const openDialog = (mode: FormDialogMode) => {
    setDialogMode(mode);
    setIsDialogOpen(true);
  };

  const handleSuccess = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  const status = internship ? formatStatus(internship.status) : null;
  const eligibleDocumentKinds = internship
    ? getEligibleDocumentKinds(internship.status)
    : [];

  return (
    <Card className={cn("mx-auto w-full max-w-3xl", className)}>
      <Card.Header className="space-y-2 text-center">
        <Card.Title className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </Card.Title>
        <Card.Description className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          Envie os comprovantes referentes ao seu estágio para validação da
          coordenação.
        </Card.Description>
      </Card.Header>

      <Card.Content className="space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-6">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        ) : !internship ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border bg-muted/30 p-6 text-center">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Nenhum estágio cadastrado
              </p>
              <p className="text-xs text-muted-foreground">
                Envie os dados e o comprovante do seu estágio para iniciar a
                validação.
              </p>
            </div>
            <Button intent="primary" onClick={() => openDialog("create")}>
              Validar estágio
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-medium text-foreground">
                  Estágio na empresa {internship.company}
                </p>
                {status ? (
                  internship.status === "REJECTED" ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        {internship.feedback?.trim() ||
                          "Nenhuma justificativa informada."}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <Badge variant={status.variant}>{status.label}</Badge>
                  )
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {formatDate(internship.start)} – {formatDate(internship.end)}
                {" · "}
                {internship.supervisor}
              </p>
            </div>

            {internship.status === "ACTIVE" ? (
              <Button intent="secondary" onClick={() => openDialog("extend")}>
                Solicitar aditivo
              </Button>
            ) : internship.status === "REJECTED" ? (
              <Button intent="secondary" onClick={() => openDialog("edit")}>
                Corrigir e reenviar
              </Button>
            ) : null}
          </div>
        )}

        {internship && eligibleDocumentKinds.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {eligibleDocumentKinds.map((kind) => (
              <Button
                key={kind}
                intent="secondary"
                size="sm"
                onClick={() => setDocumentDialogKind(kind)}
              >
                {DOCUMENT_KIND_ACTION_LABELS[kind]}
              </Button>
            ))}
          </div>
        ) : null}

        {internship ? (
          <ExtensionSubitems submissions={internship.submissions} />
        ) : null}

        {internship ? (
          <DocumentSubitems documents={internship.documents} />
        ) : null}
      </Card.Content>

      <InternshipFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        mode={dialogMode}
        internship={internship ?? null}
        onSuccess={handleSuccess}
      />

      {documentDialogKind ? (
        <InternshipDocumentUploadDialog
          open={documentDialogKind !== null}
          onOpenChange={(open) => {
            if (!open) setDocumentDialogKind(null);
          }}
          kind={documentDialogKind}
          kindLabel={DOCUMENT_KIND_LABELS[documentDialogKind]}
          onSuccess={handleSuccess}
        />
      ) : null}
    </Card>
  );
}
