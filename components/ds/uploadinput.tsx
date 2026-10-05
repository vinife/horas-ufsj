"use client"

import * as React from "react"
import { FileText, RefreshCw, UploadCloud, X } from "lucide-react"
import { notify } from "@/components/ds/notification"
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
  /**
   * When provided, the "whole area becomes a dropzone" takeover is scoped to
   * this container (position: absolute, inset-0) instead of the whole window
   * (position: fixed). Use this when UploadInput is rendered inside a Dialog
   * or other transformed ancestor, where `position: fixed` no longer resolves
   * against the viewport. When omitted, behavior is unchanged (window-wide).
   */
  overlayContainerRef?: React.RefObject<HTMLElement | null>
}

function eventHasFiles(event: DragEvent) {
  return Array.from(event.dataTransfer?.types ?? []).includes("Files")
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
  overlayContainerRef,
}: UploadInputProps) {
  const isScoped = overlayContainerRef !== undefined
  const lastRootErrorRef = React.useRef<string | undefined>(undefined)
  const removeSuccessTimeoutsRef = React.useRef<Map<string, number>>(new Map())
  const windowDragDepthRef = React.useRef(0)
  const [isWindowDragActive, setIsWindowDragActive] = React.useState(false)
  const [overlayTopOffset, setOverlayTopOffset] = React.useState(0)

  const dropzone = useDropzone<File, string>({
    onDropFile: async (file, context) => {
      if (!uploadFile) {
        notify.success("Arquivo pronto", `${file.name} foi adicionado com sucesso.`)
        return { status: "success", result: file }
      }

      const result = await uploadFile(file, context)
      if (result.status === "error") {
        notify.error(`Falha ao enviar ${file.name}`, result.error)
        return { status: "error", error: result.error }
      }

      notify.success("Upload concluído", `${file.name} foi enviado com sucesso.`)
      return { status: "success", result: file }
    },
    onRootError: (error) => {
      if (!error || lastRootErrorRef.current === error) return
      notify.error("Não foi possível adicionar o arquivo.", error)
      lastRootErrorRef.current = error
    },
    validation: {
      accept,
      maxSize,
      maxFiles: multiple ? maxFiles : 1,
    },
  })
  const { fileStatuses, onRemoveFile } = dropzone

  const files = React.useMemo(
    () => fileStatuses.map((status) => status.file),
    [fileStatuses],
  )
  const visibleFileStatuses = React.useMemo(
    () => fileStatuses.filter((status) => status.status !== "success"),
    [fileStatuses],
  )

  React.useEffect(() => {
    onChange?.(files)
  }, [files, onChange])

  React.useEffect(() => {
    const activeSuccessIds = new Set(
      fileStatuses.filter((status) => status.status === "success").map((status) => status.id),
    )

    fileStatuses.forEach((status) => {
      if (status.status !== "success") return
      if (removeSuccessTimeoutsRef.current.has(status.id)) return

      const timeoutId = window.setTimeout(() => {
        removeSuccessTimeoutsRef.current.delete(status.id)
        void onRemoveFile(status.id)
      }, 150)

      removeSuccessTimeoutsRef.current.set(status.id, timeoutId)
    })

    removeSuccessTimeoutsRef.current.forEach((timeoutId, id) => {
      if (activeSuccessIds.has(id)) return
      window.clearTimeout(timeoutId)
      removeSuccessTimeoutsRef.current.delete(id)
    })
  }, [fileStatuses, onRemoveFile])

  React.useEffect(() => {
    const timeoutMap = removeSuccessTimeoutsRef.current
    return () => {
      timeoutMap.forEach((timeoutId) => {
        window.clearTimeout(timeoutId)
      })
      timeoutMap.clear()
    }
  }, [])

  React.useEffect(() => {
    const syncOverlayTopOffset = () => {
      if (isScoped) return

      const header = document.querySelector("header")
      if (!(header instanceof HTMLElement)) {
        setOverlayTopOffset(0)
        return
      }

      setOverlayTopOffset(Math.max(header.getBoundingClientRect().bottom, 0))
    }

    const resetWindowDrag = () => {
      windowDragDepthRef.current = 0
      setIsWindowDragActive(false)
    }

    const handleDragEnter = (event: DragEvent) => {
      if (!eventHasFiles(event)) return
      syncOverlayTopOffset()
      windowDragDepthRef.current += 1
      setIsWindowDragActive(true)
    }

    const handleDragOver = (event: DragEvent) => {
      if (!eventHasFiles(event)) return
      event.preventDefault()
      syncOverlayTopOffset()
      setIsWindowDragActive(true)
    }

    const handleDragLeave = (event: DragEvent) => {
      if (!eventHasFiles(event)) return
      windowDragDepthRef.current = Math.max(windowDragDepthRef.current - 1, 0)
      if (windowDragDepthRef.current === 0) {
        setIsWindowDragActive(false)
      }
    }

    const handleDrop = (event: DragEvent) => {
      if (!eventHasFiles(event)) return
      event.preventDefault()
      resetWindowDrag()
    }

    const scopedTarget = overlayContainerRef?.current

    if (scopedTarget) {
      scopedTarget.addEventListener("dragenter", handleDragEnter)
      scopedTarget.addEventListener("dragover", handleDragOver)
      scopedTarget.addEventListener("dragleave", handleDragLeave)
      scopedTarget.addEventListener("drop", handleDrop)

      return () => {
        scopedTarget.removeEventListener("dragenter", handleDragEnter)
        scopedTarget.removeEventListener("dragover", handleDragOver)
        scopedTarget.removeEventListener("dragleave", handleDragLeave)
        scopedTarget.removeEventListener("drop", handleDrop)
      }
    }

    window.addEventListener("dragenter", handleDragEnter)
    window.addEventListener("dragover", handleDragOver)
    window.addEventListener("dragleave", handleDragLeave)
    window.addEventListener("drop", handleDrop)
    window.addEventListener("resize", syncOverlayTopOffset)
    window.addEventListener("scroll", syncOverlayTopOffset, { passive: true })

    syncOverlayTopOffset()

    return () => {
      window.removeEventListener("dragenter", handleDragEnter)
      window.removeEventListener("dragover", handleDragOver)
      window.removeEventListener("dragleave", handleDragLeave)
      window.removeEventListener("drop", handleDrop)
      window.removeEventListener("resize", syncOverlayTopOffset)
      window.removeEventListener("scroll", syncOverlayTopOffset)
    }
  }, [overlayContainerRef, isScoped])

  const isExpandedDropzone = isWindowDragActive || dropzone.isDragActive

  return (
    <Dropzone {...dropzone}>
      <div className={cn("space-y-3", className)}>
        {isExpandedDropzone && (
          <div
            aria-hidden="true"
            className={cn(
              "pointer-events-none z-40 animate-in fade-in-0 duration-200 bg-background/70 backdrop-blur-[2px]",
              isScoped ? "absolute inset-0" : "fixed inset-x-0 bottom-0",
            )}
            style={isScoped ? undefined : { top: `${overlayTopOffset}px` }}
          />
        )}

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

        {isExpandedDropzone && (
          <DropZoneArea
            data-state="open"
            style={isScoped ? undefined : { top: `${overlayTopOffset + 16}px` }}
            className={cn(
              "z-50 flex-col rounded-2xl border-2 border-dashed border-primary bg-background/95 px-6 py-8 shadow-2xl backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:slide-in-from-bottom-2",
              isScoped ? "absolute inset-3" : "fixed inset-x-4 bottom-4",
            )}
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex h-14 w-14 scale-110 items-center justify-center rounded-full border border-primary/25 bg-primary/8 text-foreground shadow-xs animate-pulse">
                <UploadCloud className="h-6 w-6 text-primary" />
              </div>
              <div className="text-base font-semibold leading-none">
                Solte o arquivo para enviar
              </div>
              <DropzoneDescription className="max-w-sm text-sm">
                {isScoped
                  ? "A área de upload foi expandida por todo o diálogo."
                  : "A área de upload foi expandida apenas pelo corpo da página."}
              </DropzoneDescription>
            </div>
          </DropZoneArea>
        )}

        {visibleFileStatuses.length > 0 && (
          <DropzoneFileList>
            {visibleFileStatuses.map((file) => (
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
