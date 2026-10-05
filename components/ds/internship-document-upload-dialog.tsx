"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UploadInput } from "@/components/ds/uploadinput";
import {
  uploadAccept,
  MAX_UPLOAD_SIZE_BYTES,
} from "@/lib/schemas/upload.schema";
import { notify } from "@/components/ds/notification";

export type InternshipDocumentKind =
  | "PARTIAL_REPORT"
  | "COMPLETION_TERM"
  | "FINAL_REPORT"
  | "TERMINATION_TERM";

type UploadProgressContext = {
  setProgress: (progress: number) => void;
};

type InternshipDocumentUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: InternshipDocumentKind;
  kindLabel: string;
  endpoint?: string;
  onSuccess?: () => void;
};

export function InternshipDocumentUploadDialog({
  open,
  onOpenChange,
  kind,
  kindLabel,
  endpoint = "/api/student/internship/documents",
  onSuccess,
}: InternshipDocumentUploadDialogProps) {
  const uploadFile = React.useCallback(
    async (file: File, context: UploadProgressContext) => {
      const formData = new FormData();
      formData.append("kind", kind);
      formData.append("file", file);

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
          resolve({ ok: false, error: "Falha de conexão ao enviar arquivo." });
        };
        xhr.onabort = () => {
          resolve({ ok: false, error: "Envio cancelado antes da conclusão." });
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
            error: "Não foi possível ler o arquivo para envio.",
          });
        }
      });

      if (!result.ok) {
        return { status: "error" as const, error: result.error };
      }

      notify.success(
        "Documento enviado",
        `${kindLabel} enviado com sucesso e aguardando revisão.`,
      );
      onSuccess?.();
      onOpenChange(false);
      return { status: "success" as const };
    },
    [endpoint, kind, kindLabel, onOpenChange, onSuccess],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{kindLabel}</DialogTitle>
          <DialogDescription>
            Envie o arquivo em .pdf, .jpeg ou .png para validação da
            coordenação.
          </DialogDescription>
        </DialogHeader>

        <UploadInput
          accept={uploadAccept}
          maxSize={MAX_UPLOAD_SIZE_BYTES}
          uploadFile={uploadFile}
        />
      </DialogContent>
    </Dialog>
  );
}
