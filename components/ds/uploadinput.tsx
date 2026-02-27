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
}: UploadInputProps) {
  const dropzone = useDropzone<File, string>({
    onDropFile: async (file) => ({ status: "success", result: file }),
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
                      <InfiniteProgress status="pending" className="w-20" />
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
