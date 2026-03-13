"use client"

import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card } from "@/components/ds/card"
import { Button } from "@/components/ds/button"
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
  title = "Enviar comprovantes",
  endpoint = "/api/student/uploads",
  className,
  files: providedFiles,
  onUpload,
  onDelete,
}: UploadCardProps) {
  const queryClient = useQueryClient()
  const queryKey = React.useMemo(() => ["uploads", endpoint], [endpoint])
  const {
    data: fetchedFiles,
    isLoading,
    isError,
  } = useQuery({
    queryKey,
    queryFn: () => fetchFiles(endpoint),
    enabled: !providedFiles,
  })

  const files = providedFiles ?? fetchedFiles ?? []

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
            resolve({ ok: false, error: "Falha de conexão ao enviar arquivo." })
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

          xhr.send(formData)
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
    if (!onDelete) return
    await onDelete(id)
    await queryClient.invalidateQueries({ queryKey })
  }

  return (
    <Card className={cn("space-y-6", className)}>
      <Card.Header className="space-y-1">
        <Card.Title>{title}</Card.Title>
      </Card.Header>

      <Card.Content className="space-y-6">
        <UploadInput
          multiple
          uploadFile={uploadSingleFile}
          onChange={(files) => onUpload?.(files)}
        />

        <div className="space-y-3">
          <div className="text-sm font-medium text-foreground">
            Arquivos enviados
          </div>

          {isLoading && (
            <div className="text-sm text-muted-foreground">Carregando...</div>
          )}
          {isError && (
            <div className="text-sm text-destructive">
              Não foi possível carregar os arquivos.
            </div>
          )}

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
              {files.length === 0 && !isLoading ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="text-muted-foreground"
                  >
                    Nenhum arquivo enviado.
                  </TableCell>
                </TableRow>
              ) : (
                files.map((file) => {
                  const status = formatStatus(file.status)
                  return (
                    <TableRow key={file.id}>
                      <TableCell className="max-w-[240px] truncate">
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
                          intent="danger"
                          size="sm"
                          onClick={() => handleDelete(file.id)}
                          disabled={!onDelete}
                        >
                          Excluir
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card.Content>
    </Card>
  )
}
