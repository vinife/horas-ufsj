import { ComplementarHourType } from "@prisma/client";
import { z } from "zod";
import {
  pageNumberSchema,
  pageSizeSchema,
  safeSearchQuerySchema,
  trimmedString,
} from "./common.schema";

export const acceptedFileExtensions = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
] as const;
export const acceptedMimeTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
] as const;
export const uploadAccept = {
  "application/pdf": [".pdf"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
} as const;
export const MAX_UPLOAD_SIZE_BYTES = 25_000_000;

export const fileSchema = z
  .custom<File>((value): value is File => value instanceof File, {
    message: "Arquivo inválido.",
  })
  .refine((file) => file.size > 0, {
    message: "Arquivo inválido ou vazio.",
  })
  .refine(
    (file) =>
      acceptedMimeTypes.includes(
        file.type as (typeof acceptedMimeTypes)[number],
      ) ||
      acceptedFileExtensions.some((extension) =>
        file.name.toLowerCase().endsWith(extension),
      ),
    {
      message: "Tipo de arquivo inválido. Use PDF, PNG ou JPG.",
    },
  )
  .refine((file) => file.size <= MAX_UPLOAD_SIZE_BYTES, {
    message: `O arquivo deve ter no máximo ${MAX_UPLOAD_SIZE_BYTES / 1_000_000}MB.`,
  });

export const uploadFormDataSchema = z.object({
  file: fileSchema,
  title: trimmedString.max(120).optional(),
  hours: z.preprocess((value) => {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed === "" ? undefined : Number(trimmed);
    }
    if (typeof value === "number") {
      return value;
    }
    return undefined;
  }, z.number().int().min(1).max(120).optional()),
});

export const uploadSearchQuerySchema = z.object({
  q: safeSearchQuerySchema,
  page: pageNumberSchema,
  pageSize: pageSizeSchema,
  sortBy: z.enum(["deadline", "name", "email"]).optional().default("deadline"),
  sortDir: z.enum(["asc", "desc"]).optional().default("asc"),
  statusFilter: z
    .enum(["pending", "reviewed", "all"])
    .optional()
    .default("all"),
});

export const deleteUploadQuerySchema = z.object({
  id: z.string().trim().min(1),
});

export const reviewCertificateSchema = z
  .object({
    decision: z.enum(["allow", "deny"]),
    hours: z.preprocess((value) => {
      if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed === "" ? undefined : Number(trimmed);
      }
      if (typeof value === "number") {
        return value;
      }
      return undefined;
    }, z.number().int().min(0).max(120)),
    commentary: trimmedString.max(1000).optional(),
    complementarHourType: z.nativeEnum(ComplementarHourType).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "deny" && !value.commentary?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["commentary"],
        message: "Comentário é obrigatório ao negar o certificado.",
      });
    }
  });

export type UploadFormInput = z.infer<typeof uploadFormDataSchema>;
export type UploadSearchQueryInput = z.infer<typeof uploadSearchQuerySchema>;
export type DeleteUploadQueryInput = z.infer<typeof deleteUploadQuerySchema>;
export type ReviewCertificateInput = z.infer<typeof reviewCertificateSchema>;
