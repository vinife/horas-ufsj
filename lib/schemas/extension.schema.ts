import { z } from "zod";
import { fileSchema } from "./upload.schema";
import { emailSchema, trimmedString } from "./common.schema";

export const extensionProjectFormSchema = z.object({
  title: trimmedString.min(1).max(160),
  coordinatorName: trimmedString.min(1).max(160),
  coordinatorEmail: emailSchema,
  coordinatorInstitution: trimmedString.min(1).max(160),
  workPlan: trimmedString.min(1).max(4000),
});

export const reviewExtensionProjectSchema = z
  .object({
    decision: z.enum(["allow", "deny"]),
    commentary: trimmedString.max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "deny" && !value.commentary?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["commentary"],
        message: "Comentário é obrigatório ao negar a proposta.",
      });
    }
  });

export const extensionCertificateUploadSchema = z.object({
  file: fileSchema,
});

export const reviewExtensionCertificateSchema = z
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
    }, z.number().int().min(0).max(200)),
    commentary: trimmedString.max(1000).optional(),
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

export type ExtensionProjectFormInput = z.infer<
  typeof extensionProjectFormSchema
>;
export type ReviewExtensionProjectInput = z.infer<
  typeof reviewExtensionProjectSchema
>;
export type ReviewExtensionCertificateInput = z.infer<
  typeof reviewExtensionCertificateSchema
>;
