import { z } from "zod";
import { fileSchema } from "./upload.schema";
import {
  pageNumberSchema,
  pageSizeSchema,
  safeSearchQuerySchema,
  trimmedString,
} from "./common.schema";

export const internshipFormDataSchema = z
  .object({
    file: fileSchema,
    company: trimmedString.min(1).max(160),
    supervisor: trimmedString.min(1).max(160),
    start: z.coerce.date(),
    end: z.coerce.date(),
  })
  .refine((value) => value.end > value.start, {
    message: "A data de término deve ser posterior à data de início.",
    path: ["end"],
  });

export const reviewInternshipSubmissionSchema = z
  .object({
    decision: z.enum(["allow", "deny"]),
    commentary: trimmedString.max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "deny" && !value.commentary?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["commentary"],
        message: "Comentário é obrigatório ao negar a submissão.",
      });
    }
  });

export const finalizeInternshipSchema = z.object({
  status: z.enum(["COMPLETED", "TERMINATED"]),
});

export const internshipSearchQuerySchema = z.object({
  q: safeSearchQuerySchema,
  page: pageNumberSchema,
  pageSize: pageSizeSchema,
});

export type InternshipFormInput = z.infer<typeof internshipFormDataSchema>;
export type ReviewInternshipSubmissionInput = z.infer<
  typeof reviewInternshipSubmissionSchema
>;
export type FinalizeInternshipInput = z.infer<typeof finalizeInternshipSchema>;
export type InternshipSearchQueryInput = z.infer<
  typeof internshipSearchQuerySchema
>;
