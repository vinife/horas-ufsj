"use client"

import * as React from "react"
import { FileText, RefreshCw, UploadCloud, X } from "lucide-react"
import type { Accept } from "react-dropzone"
import {
  Dropzone,
  DropZoneArea,
  DropzoneDescription,
  DropzoneFileList,
  DropzoneFileListItem,
  DropzoneFileMessage,
  DropzoneMessage,
  DropzoneRemoveFile,
  DropzoneRetryFile,
  DropzoneTrigger,
  InfiniteProgress,
  useDropzone,
} from "@/components/ui/dropzone"
import { cn } from "@/lib/utils"

type UploadInputProps = {
  className?: string
  label?: string
  hint?: string
  multiple?: boolean
  accept?: Accept
  maxSize?: number
  maxFiles?: number
  onChange?: (files: File[]) => void
  uploadFile?: (
    file: File,
    context: { setProgress: (progress: number) => void },
  ) => Promise<{ status: "success" } | { status: "error"; error: string }>
  children?: React.ReactNode
}

export function UploadInput({
  className,
  label = "Arraste os arquivos aqui",
  hint = "ou clique para selecionar",
  multiple = false,
  accept,
  maxSize,
  maxFiles,
  onChange,
  uploadFile,
}: UploadInputProps) {
  const dropzone = useDropzone<File, string>({
    onDropFile: async (file, context) => {
      if (!uploadFile) {
        return { status: "success", result: file }
      }

      const result = await uploadFile(file, context)
      if (result.status === "error") {
        return { status: "error", error: result.error }
      }

      return { status: "success", result: file }
    },
    validation: {
      accept,
      maxSize,
      maxFiles: multiple ? maxFiles : 1,
    },
  })

  const files = React.useMemo(
    () => dropzone.fileStatuses.map((status) => status.file),
    [dropzone.fileStatuses],
  )

  React.useEffect(() => {
    onChange?.(files)
  }, [files, onChange])

  return (
    <Dropzone {...dropzone}>
      <div className={cn("space-y-3", className)}>
        <DropZoneArea className="flex-col px-6 py-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-background text-foreground shadow-xs">
              <UploadCloud className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="text-sm font-medium leading-none">{label}</div>
            <DropzoneDescription>{hint}</DropzoneDescription>
            <DropzoneMessage />
            <DropzoneTrigger className="mt-1">Selecionar</DropzoneTrigger>
          </div>
        </DropZoneArea>

        {dropzone.fileStatuses.length > 0 && (
          <DropzoneFileList>
            {dropzone.fileStatuses.map((file) => (
              <DropzoneFileListItem
                key={file.id}
                file={file}
                className="border border-border bg-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm text-foreground">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{file.fileName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {file.status === "pending" && (
                      <div className="w-28 space-y-1">
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-[width] duration-150"
                            style={{ width: `${Math.max(file.progress, 2)}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-muted-foreground text-right">
                          {Math.round(file.progress)}%
                        </div>
                      </div>
                    )}
                    {file.status === "success" && (
                      <InfiniteProgress status="success" className="w-20" />
                    )}
                    {file.status === "error" && (
                      <DropzoneRetryFile variant="ghost" size="icon">
                        <RefreshCw className="h-4 w-4" />
                      </DropzoneRetryFile>
                    )}
                    <DropzoneRemoveFile variant="ghost" size="icon">
                      <X className="h-4 w-4" />
                    </DropzoneRemoveFile>
                  </div>
                </div>
                <DropzoneFileMessage />
              </DropzoneFileListItem>
            ))}
          </DropzoneFileList>
        )}
      </div>
    </Dropzone>
  )
}
