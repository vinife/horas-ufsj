"use client";

import * as React from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ds/button";
import { notify } from "@/components/ds/notification";
import { UploadInput } from "@/components/ds/uploadinput";
import type { InternshipPayload } from "@/components/ds/internshipcard";
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
import {
  uploadAccept,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/lib/schemas/upload.schema";

const INTERNSHIP_ENDPOINT = "/api/student/internship";

type InternshipFormDialogMode = "create" | "edit" | "extend";

type InternshipFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: InternshipFormDialogMode;
  internship: InternshipPayload | null;
  onSuccess?: () => void;
};

type FormState = {
  company: string;
  supervisor: string;
  start: string;
  end: string;
};

const EMPTY_FORM_STATE: FormState = {
  company: "",
  supervisor: "",
  start: "",
  end: "",
};

function toDateInputValue(value: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function getInitialFormState(
  mode: InternshipFormDialogMode,
  internship: InternshipPayload | null,
): FormState {
  if (mode === "create" || !internship) {
    return EMPTY_FORM_STATE;
  }

  return {
    company: internship.company,
    supervisor: internship.supervisor,
    start: toDateInputValue(internship.start),
    end: toDateInputValue(internship.end),
  };
}

function getDialogCopy(mode: InternshipFormDialogMode) {
  switch (mode) {
    case "edit":
      return {
        title: "Corrigir e reenviar estágio",
        description:
          "Atualize os dados do estágio e reenvie o comprovante para nova avaliação.",
      };
    case "extend":
      return {
        title: "Solicitar aditivo de estágio",
        description:
          "Informe o novo período e envie o comprovante do aditivo de estágio.",
      };
    default:
      return {
        title: "Validar estágio",
        description:
          "Informe os dados do seu estágio e envie o comprovante para avaliação.",
      };
  }
}

export function InternshipFormDialog({
  open,
  onOpenChange,
  mode,
  internship,
  onSuccess,
}: InternshipFormDialogProps) {
  const [formState, setFormState] = React.useState<FormState>(
    EMPTY_FORM_STATE,
  );
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [uploadKey, setUploadKey] = React.useState(0);
  const dialogBodyRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    setFormState(getInitialFormState(mode, internship));
    setSelectedFile(null);
    setUploadKey((prev) => prev + 1);
  }, [open, mode, internship]);

  const copy = getDialogCopy(mode);
  const isStartLocked = mode === "extend";

  const updateField = (field: keyof FormState, value: string) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    const company = formState.company.trim();
    const supervisor = formState.supervisor.trim();
    const start = formState.start;
    const end = formState.end;

    if (!company || !supervisor) {
      notify.warning(
        "Campos obrigatórios",
        "Informe a empresa e o supervisor do estágio.",
      );
      return;
    }

    if (!start || !end) {
      notify.warning(
        "Período obrigatório",
        "Informe as datas de início e término do estágio.",
      );
      return;
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (endDate <= startDate) {
      notify.error(
        "Período inválido",
        "A data de término deve ser posterior à data de início.",
      );
      return;
    }

    if (mode === "extend" && internship) {
      const currentEndDate = new Date(internship.end);
      if (endDate <= currentEndDate) {
        notify.error(
          "Período inválido",
          "A nova data de término deve ser posterior ao período atual.",
        );
        return;
      }
    }

    if (!selectedFile) {
      notify.warning(
        "Arquivo obrigatório",
        "Selecione o comprovante do estágio antes de enviar.",
      );
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("company", company);
    formData.append("supervisor", supervisor);
    formData.append("start", start);
    formData.append("end", end);

    setIsSubmitting(true);
    try {
      const res = await fetch(INTERNSHIP_ENDPOINT, {
        method: mode === "create" ? "POST" : "PATCH",
        credentials: "include",
        body: formData,
      });

      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(
          data?.error ?? "Não foi possível enviar os dados do estágio.",
        );
      }

      notify.success(
        "Estágio enviado",
        "Os dados do estágio foram enviados para avaliação.",
      );
      onSuccess?.();
      onOpenChange(false);
    } catch (error) {
      notify.error(
        "Falha ao enviar estágio",
        error instanceof Error
          ? error.message
          : "Não foi possível enviar os dados do estágio.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <div ref={dialogBodyRef} className="relative grid gap-4">
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="grid gap-2">
              <label className="text-sm font-medium">Comprovante</label>
              <UploadInput
                key={uploadKey}
                multiple={false}
                accept={uploadAccept}
                maxSize={MAX_UPLOAD_SIZE_BYTES}
                overlayContainerRef={dialogBodyRef}
                onChange={(files) => {
                  if (files.length > 0) {
                    setSelectedFile(files[0]);
                  }
                }}
              />
              {selectedFile ? (
                <p className="text-xs text-muted-foreground">
                  Arquivo selecionado: {selectedFile.name}
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Empresa</label>
              <Input
                value={formState.company}
                onChange={(event) =>
                  updateField("company", event.target.value)
                }
                placeholder="Nome da empresa"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium">Supervisor</label>
              <Input
                value={formState.supervisor}
                onChange={(event) =>
                  updateField("supervisor", event.target.value)
                }
                placeholder="Nome do supervisor"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <label className="text-sm font-medium">Início</label>
                <Input
                  type="date"
                  value={formState.start}
                  disabled={isStartLocked}
                  onChange={(event) =>
                    updateField("start", event.target.value)
                  }
                />
              </div>
              <div className="grid gap-2">
                <label className="text-sm font-medium">Término</label>
                <Input
                  type="date"
                  value={formState.end}
                  onChange={(event) => updateField("end", event.target.value)}
                />
              </div>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
