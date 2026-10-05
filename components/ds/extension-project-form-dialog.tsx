"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ds/button";
import { notify } from "@/components/ds/notification";
import type { ExtensionProjectPayload } from "@/components/ds/extension-card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const EXTENSIONS_ENDPOINT = "/api/student/extensions";

type ExtensionProjectFormDialogMode = "create" | "edit";

type ExtensionProjectFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: ExtensionProjectFormDialogMode;
  project: ExtensionProjectPayload | null;
  onSuccess?: () => void;
};

type FormState = {
  title: string;
  coordinatorName: string;
  coordinatorEmail: string;
  coordinatorInstitution: string;
  workPlan: string;
};

const EMPTY_FORM_STATE: FormState = {
  title: "",
  coordinatorName: "",
  coordinatorEmail: "",
  coordinatorInstitution: "",
  workPlan: "",
};

function getInitialFormState(
  mode: ExtensionProjectFormDialogMode,
  project: ExtensionProjectPayload | null,
): FormState {
  if (mode === "create" || !project) {
    return EMPTY_FORM_STATE;
  }

  return {
    title: project.title,
    coordinatorName: project.coordinatorName,
    coordinatorEmail: project.coordinatorEmail,
    coordinatorInstitution: project.coordinatorInstitution,
    workPlan: project.workPlan,
  };
}

export function ExtensionProjectFormDialog({
  open,
  onOpenChange,
  mode,
  project,
  onSuccess,
}: ExtensionProjectFormDialogProps) {
  const [formState, setFormState] = React.useState<FormState>(EMPTY_FORM_STATE);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    setFormState(getInitialFormState(mode, project));
  }, [open, mode, project]);

  const updateField = (field: keyof FormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const title = formState.title.trim();
    const coordinatorName = formState.coordinatorName.trim();
    const coordinatorEmail = formState.coordinatorEmail.trim();
    const coordinatorInstitution = formState.coordinatorInstitution.trim();
    const workPlan = formState.workPlan.trim();

    if (
      !title ||
      !coordinatorName ||
      !coordinatorEmail ||
      !coordinatorInstitution ||
      !workPlan
    ) {
      notify.warning(
        "Campos obrigatórios",
        "Preencha todos os campos antes de enviar.",
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(
        mode === "create"
          ? EXTENSIONS_ENDPOINT
          : `${EXTENSIONS_ENDPOINT}/${project?.id}`,
        {
          method: mode === "create" ? "POST" : "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            coordinatorName,
            coordinatorEmail,
            coordinatorInstitution,
            workPlan,
          }),
        },
      );

      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(
          data?.error ?? "Não foi possível enviar a proposta de extensão.",
        );
      }

      notify.success(
        "Proposta enviada",
        "A proposta de extensão foi enviada para avaliação.",
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      notify.error(
        "Falha ao enviar proposta",
        error instanceof Error
          ? error.message
          : "Não foi possível enviar a proposta de extensão.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create"
              ? "Nova proposta de extensão"
              : "Corrigir e reenviar proposta"}
          </DialogTitle>
          <DialogDescription>
            Informe os dados do projeto, programa ou ação de extensão para
            avaliação da coordenação.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">
              Título do projeto, programa ou ação
            </label>
            <Input
              value={formState.title}
              onChange={(event) => updateField("title", event.target.value)}
              placeholder="Ex.: Programa de extensão X"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">
              Nome completo do coordenador
            </label>
            <Input
              value={formState.coordinatorName}
              onChange={(event) =>
                updateField("coordinatorName", event.target.value)
              }
              placeholder="Nome do coordenador do projeto"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                Email do coordenador
              </label>
              <Input
                type="email"
                value={formState.coordinatorEmail}
                onChange={(event) =>
                  updateField("coordinatorEmail", event.target.value)
                }
                placeholder="coordenador@ufsj.edu.br"
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm font-medium">
                Instituição do coordenador
              </label>
              <Input
                value={formState.coordinatorInstitution}
                onChange={(event) =>
                  updateField("coordinatorInstitution", event.target.value)
                }
                placeholder="Ex.: UFSJ"
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Plano de trabalho</label>
            <Textarea
              value={formState.workPlan}
              onChange={(event) => updateField("workPlan", event.target.value)}
              placeholder="Descreva as atividades de extensão a serem realizadas..."
              className="min-h-32"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            intent="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            intent="primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting ? (
              <>
                <Spinner className="h-4 w-4" />
                Enviando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Enviar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
