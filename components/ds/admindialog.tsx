"use client"

import * as React from "react"
import { ExternalLink } from "lucide-react"
import { notify } from "@/components/ds/notification"
import { Badge } from "@/components/ui/badge"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ds/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type FileStatus = "PENDENTE" | "APROVADO" | "REJEITADO"

export type StudentReviewFile = {
  id: string
  title: string
  hours: number
  status: FileStatus
  fileUrl: string
  createdAt: string | Date
}

export type StudentReview = {
  id: string
  name: string | null
  email: string
  status: FileStatus
  files: StudentReviewFile[]
}

type AdminDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  student: StudentReview | null
  onApprove?: (id: string) => void | Promise<void>
  onReject?: (id: string) => void | Promise<void>
  onReview?: (payload: {
    id: string
    decision: "allow" | "deny"
    hours: number
    commentary?: string
  }) => void | Promise<void>
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

function formatDate(input: string | Date) {
  const date = input instanceof Date ? input : new Date(input)
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("pt-BR")
}

type ReviewFormState = {
  decision: "allow" | "deny"
  valuedHours: number
  commentary: string
}

const HOURS_OPTIONS = Array.from({ length: 101 }, (_, i) => i)

export function AdminDialog({
  open,
  onOpenChange,
  student,
  onApprove,
  onReject,
  onReview,
}: AdminDialogProps) {
  const [reviewStateByFileId, setReviewStateByFileId] = React.useState<
    Record<string, ReviewFormState>
  >({})
  const [savingByFileId, setSavingByFileId] = React.useState<Record<string, boolean>>({})

  React.useEffect(() => {
    if (!open || !student) return

    const nextState: Record<string, ReviewFormState> = {}
    for (const file of student.files) {
      const clampedHours = Math.max(0, Math.min(100, file.hours))
      nextState[file.id] = {
        decision: "allow",
        valuedHours: clampedHours,
        commentary: "",
      }
    }

    setReviewStateByFileId(nextState)
    setSavingByFileId({})
  }, [open, student])

  const updateFileState = React.useCallback(
    (fileId: string, updater: (prev: ReviewFormState) => ReviewFormState) => {
      setReviewStateByFileId((prev) => {
        const current = prev[fileId] ?? {
          decision: "allow" as const,
          valuedHours: 0,
          commentary: "",
        }
        return {
          ...prev,
          [fileId]: updater(current),
        }
      })
    },
    [],
  )

  const handleSubmitReview = React.useCallback(
    async (file: StudentReviewFile) => {
      const state = reviewStateByFileId[file.id]
      if (!state) return

      if (
        !Number.isFinite(state.valuedHours) ||
        state.valuedHours < 0 ||
        state.valuedHours > 100
      ) {
        notify.error(
          "Horas inválidas",
          "Informe horas validadas entre 0 e 100.",
        )
        return
      }

      if (state.decision === "deny" && !state.commentary.trim()) {
        notify.warning(
          "Justificativa obrigatória",
          "Adicione uma justificativa quando o arquivo for negado.",
        )
        return
      }

      setSavingByFileId((prev) => ({ ...prev, [file.id]: true }))
      try {
        if (onReview) {
          await onReview({
            id: file.id,
            decision: state.decision,
            hours: state.valuedHours,
            commentary: state.commentary.trim() || undefined,
          })
        } else if (state.decision === "allow") {
          if (!onApprove) {
            notify.info(
              "Ação indisponível",
              "A aprovação ainda não está configurada para este fluxo.",
            )
            return
          }
          await onApprove(file.id)
        } else {
          if (!onReject) {
            notify.info(
              "Ação indisponível",
              "A rejeição ainda não está configurada para este fluxo.",
            )
            return
          }
          await onReject(file.id)
        }
        notify.success(
          state.decision === "allow"
            ? "Arquivo aprovado"
            : "Arquivo rejeitado",
          `${file.title} foi avaliado com sucesso.`,
        )
      } catch (error) {
        notify.error(
          "Falha ao salvar avaliação",
          error instanceof Error
            ? error.message
            : "Não foi possível salvar a avaliação.",
        )
      } finally {
        setSavingByFileId((prev) => ({ ...prev, [file.id]: false }))
      }
    },
    [onApprove, onReject, onReview, reviewStateByFileId],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {student?.name ?? "Aluno"} <span className="text-muted-foreground">({student?.email ?? "-"})</span>
          </DialogTitle>
          <DialogDescription>
            Arquivos pendentes para revisao.
          </DialogDescription>
        </DialogHeader>

        {!student || student.files.length === 0 ? (
          <div className="rounded-md border p-4 text-sm text-muted-foreground">
            Nenhum arquivo pendente.
          </div>
        ) : (
          <Accordion type="single" collapsible>
            {student.files.map((file) => {
              const status = formatStatus(file.status)
              const state = reviewStateByFileId[file.id] ?? {
                decision: "allow" as const,
                valuedHours: Math.max(0, Math.min(100, file.hours)),
                commentary: "",
              }
              const isDenied = state.decision === "deny"
              const isSaving = savingByFileId[file.id] === true

              return (
                <AccordionItem key={file.id} value={file.id}>
                  <AccordionTrigger>
                    <div className="flex w-full flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                      <span className="truncate font-medium">
                        {file.title}
                      </span>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <span className="text-xs text-muted-foreground">
                          {formatDate(file.createdAt)}
                        </span>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid gap-4">
                      <a
                        href={file.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline"
                      >
                        Abrir arquivo
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                      </a>

                      <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap lg:flex-nowrap">
                        <div className="grid gap-2 flex-1 sm:flex-initial">
                          <span className="text-sm font-medium">Decisao</span>
                          <RadioGroup
                            value={state.decision}
                            onValueChange={(value) => {
                              if (value !== "allow" && value !== "deny") return
                              updateFileState(file.id, (prev) => ({
                                ...prev,
                                decision: value,
                                commentary: value === "deny" ? prev.commentary : "",
                              }))
                            }}
                            className="grid grid-cols-2 gap-3"
                          >
                            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                              <RadioGroupItem value="allow" />
                              Aprovar
                            </label>
                            <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
                              <RadioGroupItem value="deny" />
                              Negar
                            </label>
                          </RadioGroup>
                        </div>

                        <div className="grid gap-2 flex-1 sm:flex-initial sm:min-w-[130px]">
                          <label className="text-sm font-medium">Horas validadas</label>
                          <Select
                            value={String(state.valuedHours)}
                            onValueChange={(value) => {
                              const parsed = Number(value)
                              updateFileState(file.id, (prev) => ({
                                ...prev,
                                valuedHours: Number.isFinite(parsed) ? parsed : 0,
                              }))
                            }}
                          >
                            <SelectTrigger className="w-full rounded-md">
                              <SelectValue placeholder="Horas" />
                            </SelectTrigger>
                            <SelectContent>
                              {HOURS_OPTIONS.map((hour) => (
                                <SelectItem key={hour} value={String(hour)}>
                                  {hour}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <div
                        className={cn(
                          "grid overflow-hidden transition-all duration-300 ease-out",
                          isDenied
                            ? "grid-rows-[1fr] opacity-100"
                            : "pointer-events-none grid-rows-[0fr] opacity-0",
                        )}
                        aria-hidden={!isDenied}
                      >
                        <div className="min-h-0">
                          <div className="grid gap-2">
                            <label className="text-sm font-medium">
                              Comentario (obrigatorio se negar)
                            </label>
                            <textarea
                              className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                              disabled={!isDenied}
                              placeholder="Explique o motivo da negacao..."
                              value={state.commentary}
                              onChange={(event) => {
                                updateFileState(file.id, (prev) => ({
                                  ...prev,
                                  commentary: event.target.value,
                                }))
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="w-full">
                        <Button
                          size="sm"
                          intent={isDenied ? "danger" : "primary"}
                          disabled={isSaving}
                          onClick={() => handleSubmitReview(file)}
                          className="w-full sm:w-auto"
                        >
                          {isSaving ? "Salvando..." : "Salvar avaliacao"}
                        </Button>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        )}
      </DialogContent>
    </Dialog>
  )
}
