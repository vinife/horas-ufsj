"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Trash2 } from "lucide-react"
import { Card } from "@/components/ds/card"
import { Button } from "@/components/ds/button"
import { notify } from "@/components/ds/notification"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UploadInput } from "@/components/ds/uploadinput"
import { uploadAccept, MAX_UPLOAD_SIZE_BYTES } from "@/lib/schemas/upload.schema"
import { cn } from "@/lib/utils"

type FileStatus = "PENDENTE" | "APROVADO" | "REJEITADO"

export type UploadedFile = {
  id: string
  title: string
  hours: number
  status: FileStatus
  fileUrl: string
  createdAt: string
}

type UploadCardProps = {
  title?: string
  subtitle?: string
  endpoint?: string
  className?: string
  files?: UploadedFile[]
  onUpload?: (files: File[]) => void | Promise<void>
  onDelete?: (id: string) => void | Promise<void>
}

type UploadProgressContext = {
  setProgress: (progress: number) => void
}

async function fetchFiles(endpoint: string): Promise<UploadedFile[]> {
  const res = await fetch(endpoint)
  if (!res.ok) {
    throw new Error("Failed to fetch files")
  }
  const data = await res.json()
  return data.files
}

async function deleteFile(endpoint: string, id: string) {
  const params = new URLSearchParams({ id })
  const res = await fetch(`${endpoint}?${params.toString()}`, {
    method: "DELETE",
  })

  const data = (await res.json().catch(() => null)) as { error?: string } | null

  if (!res.ok) {
    throw new Error(data?.error ?? "Não foi possível excluir o arquivo.")
  }
}

function formatStatus(status: FileStatus) {
  switch (status) {
    case "APROVADO":
      return { label: "Aprovado", variant: "approved" as const }
    case "REJEITADO":
      return { label: "Rejeitado", variant: "denied" as const }
    default:
      return { label: "Pendente", variant: "pending" as const }
  }
}

export function UploadCard({
  title = "Horas",
  subtitle = "Envie seus arquivos em .pdf, .jpeg ou .png para que possam ser avaliados pela coordenação.",
  endpoint = "/api/student/uploads",
  className,
  files: providedFiles,
  onUpload,
  onDelete,
}: UploadCardProps) {
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = React.useState<string | null>(null)
  const hasShownLoadErrorRef = React.useRef(false)
  const queryKey = React.useMemo(() => ["uploads", endpoint], [endpoint])
  const {
    data: fetchedFiles,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => fetchFiles(endpoint),
    enabled: !providedFiles,
  })

  const files = providedFiles ?? fetchedFiles ?? []

  React.useEffect(() => {
    if (!isError) {
      hasShownLoadErrorRef.current = false
      return
    }

    if (hasShownLoadErrorRef.current) return
    notify.error(
      "Falha ao carregar arquivos",
      "Não foi possível carregar os arquivos enviados.",
    )
    hasShownLoadErrorRef.current = true
  }, [isError])

  const uploadSingleFile = React.useCallback(
    async (file: File, context: UploadProgressContext) => {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("title", file.name.replace(/\.[^.]+$/, ""))
      formData.append("hours", "1")

      const result = await new Promise<{ ok: true } | { ok: false; error: string }>(
        (resolve) => {
          const xhr = new XMLHttpRequest()

          xhr.open("POST", endpoint)
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              context.setProgress((event.loaded / event.total) * 100)
            }
          }
          xhr.onerror = () => {
            const error =
              xhr.status === 0
                ? "Nao foi possivel ler o arquivo para envio. Tente selecionar o arquivo pelo botao ou mova-o para uma pasta local antes de enviar."
                : "Falha de conexão ao enviar arquivo."
            resolve({ ok: false, error })
          }
          xhr.onabort = () => {
            resolve({ ok: false, error: "Envio cancelado antes da conclusao." })
          }
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              context.setProgress(100)
              resolve({ ok: true })
              return
            }

            try {
              const data = JSON.parse(xhr.responseText) as { error?: string }
              resolve({
                ok: false,
                error: data.error ?? "Falha ao enviar arquivo.",
              })
            } catch {
              resolve({ ok: false, error: "Falha ao enviar arquivo." })
            }
          }

          try {
            xhr.send(formData)
          } catch {
            resolve({
              ok: false,
              error:
                "Nao foi possivel ler o arquivo para envio. Tente selecionar o arquivo pelo botao ou mova-o para uma pasta local antes de enviar.",
            })
          }
        },
      )

      if (!result.ok) {
        return { status: "error" as const, error: result.error }
      }

      await queryClient.invalidateQueries({ queryKey })
      return { status: "success" as const }
    },
    [endpoint, queryClient, queryKey],
  )

  const handleDelete = async (id: string) => {
    try {
      setDeletingId(id)
      if (onDelete) {
        await onDelete(id)
      } else {
        await deleteFile(endpoint, id)
      }
      await queryClient.invalidateQueries({ queryKey })
      notify.success("Arquivo excluído", "O arquivo foi removido com sucesso.")
    } catch (error) {
      notify.error(
        "Falha ao excluir arquivo",
        error instanceof Error ? error.message : "Não foi possível excluir o arquivo.",
      )
    } finally {
      setDeletingId((currentId) => (currentId === id ? null : currentId))
    }
  }

  return (
    <Card className={cn("mx-auto w-full max-w-3xl space-y-6", className)}>
      <Card.Header className="space-y-2 text-center">
        <Card.Title className="text-2xl font-bold tracking-tight sm:text-3xl">
          {title}
        </Card.Title>
        <Card.Description className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          {subtitle}
        </Card.Description>
      </Card.Header>

      <Card.Content className="space-y-6">
        <UploadInput
          multiple
          accept={uploadAccept}
          maxSize={MAX_UPLOAD_SIZE_BYTES}
          uploadFile={uploadSingleFile}
          onChange={(files) => onUpload?.(files)}
        />

        {files.length > 0 && (
          <div className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Arquivo</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map((file) => {
                  const status = formatStatus(file.status)
                  const isDeleteDisabled =
                    file.status === "APROVADO" || deletingId === file.id
                  return (
                    <TableRow key={file.id}>
                      <TableCell className="max-w-60 truncate">
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-primary hover:underline"
                        >
                          {file.title}
                        </a>
                      </TableCell>
                      <TableCell>{file.hours}</TableCell>
                      <TableCell>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          intent="tertiary"
                          size="icon-sm"
                          onClick={() => handleDelete(file.id)}
                          disabled={isDeleteDisabled}
                          aria-label={`Excluir ${file.title}`}
                          title="Excluir"
                        >
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card.Content>
    </Card>
  )
}
