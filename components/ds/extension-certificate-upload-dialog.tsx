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

type UploadProgressContext = {
  setProgress: (progress: number) => void;
};

type ExtensionCertificateUploadDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectTitle: string;
  onSuccess?: () => void;
};

export function ExtensionCertificateUploadDialog({
  open,
  onOpenChange,
  projectId,
  projectTitle,
  onSuccess,
}: ExtensionCertificateUploadDialogProps) {
  const endpoint = `/api/student/extensions/${projectId}/certificate`;

  const uploadFile = React.useCallback(
    async (file: File, context: UploadProgressContext) => {
      const formData = new FormData();
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
        "Certificado enviado",
        "O certificado foi enviado com sucesso e aguarda revisão.",
      );
      onSuccess?.();
      onOpenChange(false);
      return { status: "success" as const };
    },
    [endpoint, onOpenChange, onSuccess],
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar certificado</DialogTitle>
          <DialogDescription>
            Envie o certificado assinado de &quot;{projectTitle}&quot; em
            .pdf, .jpeg ou .png para validação da coordenação.
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
