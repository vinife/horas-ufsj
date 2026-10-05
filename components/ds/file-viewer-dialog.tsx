"use client";

import { FileViewer } from "@/components/ds/file-viewer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type FileViewerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  fileUrl: string;
  fileName?: string;
};

export function FileViewerDialog({
  open,
  onOpenChange,
  fileUrl,
  fileName,
}: FileViewerDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">
            {fileName ?? "Visualizar arquivo"}
          </DialogTitle>
          <DialogDescription>Pré-visualização do arquivo enviado.</DialogDescription>
        </DialogHeader>

        <FileViewer fileUrl={fileUrl} fileName={fileName} className="h-[60vh]" />
      </DialogContent>
    </Dialog>
  );
}
