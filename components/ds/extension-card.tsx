"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Card } from "@/components/ds/card";
import { Button } from "@/components/ds/button";
import { notify } from "@/components/ds/notification";
import { ExtensionProjectFormDialog } from "@/components/ds/extension-project-form-dialog";
import { ExtensionCertificateUploadDialog } from "@/components/ds/extension-certificate-upload-dialog";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

export type ExtensionCertificatePayload = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  hours: number | null;
  feedback: string | null;
  createdAt: string;
};

export type ExtensionProjectPayload = {
  id: string;
  title: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coordinatorInstitution: string;
  workPlan: string;
  status: "PENDING" | "ACTIVE" | "REJECTED" | "COMPLETED";
  feedback: string | null;
  createdAt: string;
  updatedAt: string;
  certificate: ExtensionCertificatePayload | null;
};

type ExtensionCardProps = {
  title?: string;
  endpoint?: string;
  className?: string;
};

type FormDialogState =
  | { mode: "create" }
  | { mode: "edit"; project: ExtensionProjectPayload };

async function fetchProjects(
  endpoint: string,
): Promise<ExtensionProjectPayload[]> {
  const res = await fetch(endpoint, { credentials: "include" });
  if (!res.ok) {
    throw new Error("Failed to fetch extension projects");
  }
  const data = (await res.json()) as { projects?: ExtensionProjectPayload[] };
  return data.projects ?? [];
}

function formatDate(input: string) {
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR");
}

function formatStatus(status: ExtensionProjectPayload["status"]) {
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

function formatCertificateStatus(
  status: ExtensionCertificatePayload["status"],
) {
  switch (status) {
    case "APPROVED":
      return { label: "Certificado aprovado", variant: "approved" as const };
    case "REJECTED":
      return { label: "Certificado rejeitado", variant: "denied" as const };
    default:
      return { label: "Certificado em análise", variant: "pending" as const };
  }
}

function ProjectCard({
  project,
  onEdit,
  onUploadCertificate,
}: {
  project: ExtensionProjectPayload;
  onEdit: () => void;
  onUploadCertificate: () => void;
}) {
  const status = formatStatus(project.status);
  const canUploadCertificate =
    project.status === "ACTIVE" &&
    (!project.certificate || project.certificate.status === "REJECTED");

  return (
    <div className="grid gap-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="truncate font-medium text-foreground">
            {project.title}
          </p>
          <p className="text-sm text-muted-foreground">
            Coordenador: {project.coordinatorName} ({project.coordinatorEmail}
            ) · {project.coordinatorInstitution}
          </p>
        </div>
        {project.status === "REJECTED" ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant={status.variant}>{status.label}</Badge>
            </TooltipTrigger>
            <TooltipContent>
              {project.feedback?.trim() || "Nenhuma justificativa informada."}
            </TooltipContent>
          </Tooltip>
        ) : (
          <Badge variant={status.variant}>{status.label}</Badge>
        )}
      </div>

      {project.status === "REJECTED" ? (
        <div>
          <Button intent="secondary" size="sm" onClick={onEdit}>
            Corrigir e reenviar
          </Button>
        </div>
      ) : null}

      {canUploadCertificate ? (
        <div>
          <Button intent="secondary" size="sm" onClick={onUploadCertificate}>
            Enviar certificado
          </Button>
        </div>
      ) : null}

      {project.certificate && project.status !== "REJECTED" ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {project.certificate.status === "REJECTED" ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="denied">
                  {formatCertificateStatus(project.certificate.status).label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                {project.certificate.feedback?.trim() ||
                  "Nenhuma justificativa informada."}
              </TooltipContent>
            </Tooltip>
          ) : (
            <Badge
              variant={formatCertificateStatus(project.certificate.status).variant}
            >
              {formatCertificateStatus(project.certificate.status).label}
            </Badge>
          )}
          {project.certificate.status === "APPROVED" &&
          project.certificate.hours != null ? (
            <span>{project.certificate.hours}h concedidas</span>
          ) : (
            <span>{formatDate(project.certificate.createdAt)}</span>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ExtensionCard({
  title = "Extensão",
  endpoint = "/api/student/extensions",
  className,
}: ExtensionCardProps) {
  const queryClient = useQueryClient();
  const queryKey = React.useMemo(() => ["extension-projects", endpoint], [
    endpoint,
  ]);
  const hasShownLoadErrorRef = React.useRef(false);

  const [formDialog, setFormDialog] = React.useState<FormDialogState | null>(
    null,
  );
  const [certificateDialogProject, setCertificateDialogProject] =
    React.useState<ExtensionProjectPayload | null>(null);

  const { data: projects, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => fetchProjects(endpoint),
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

  const handleSuccess = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey]);

  return (
    <Card className={cn("mx-auto w-full max-w-3xl", className)}>
      <Card.Header className="space-y-2 text-center">
        <Card.Title className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </Card.Title>
        <Card.Description className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          Cadastre seus projetos de extensão para validação da coordenação.
        </Card.Description>
      </Card.Header>

      <Card.Content className="space-y-4">
        <div className="flex justify-center">
          <Button
            intent="primary"
            className="gap-2"
            onClick={() => setFormDialog({ mode: "create" })}
          >
            <Plus className="h-4 w-4" />
            Novo projeto
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center rounded-lg border bg-muted/30 p-6">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        ) : !projects || projects.length === 0 ? (
          <div className="flex flex-col items-center gap-1 rounded-lg border bg-muted/30 p-6 text-center">
            <p className="text-sm font-medium text-foreground">
              Nenhum projeto de extensão cadastrado
            </p>
            <p className="text-xs text-muted-foreground">
              Clique em &quot;Novo projeto&quot; para cadastrar sua primeira
              proposta.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onEdit={() => setFormDialog({ mode: "edit", project })}
                onUploadCertificate={() => setCertificateDialogProject(project)}
              />
            ))}
          </div>
        )}
      </Card.Content>

      <ExtensionProjectFormDialog
        open={formDialog !== null}
        onOpenChange={(open) => {
          if (!open) setFormDialog(null);
        }}
        mode={formDialog?.mode ?? "create"}
        project={formDialog?.mode === "edit" ? formDialog.project : null}
        onSuccess={handleSuccess}
      />

      {certificateDialogProject ? (
        <ExtensionCertificateUploadDialog
          open={certificateDialogProject !== null}
          onOpenChange={(open) => {
            if (!open) setCertificateDialogProject(null);
          }}
          projectId={certificateDialogProject.id}
          projectTitle={certificateDialogProject.title}
          onSuccess={handleSuccess}
        />
      ) : null}
    </Card>
  );
}
