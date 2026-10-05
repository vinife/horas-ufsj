import { InternshipDocumentKind } from "@prisma/client";
import { z } from "zod";
import { fileSchema } from "./upload.schema";
import { trimmedString } from "./common.schema";

export const internshipDocumentUploadSchema = z.object({
  kind: z.nativeEnum(InternshipDocumentKind),
  file: fileSchema,
});

export const reviewInternshipDocumentSchema = z
  .object({
    decision: z.enum(["allow", "deny"]),
    commentary: trimmedString.max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "deny" && !value.commentary?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["commentary"],
        message: "Comentário é obrigatório ao negar o documento.",
      });
    }
  });

export const setInternshipHoursSchema = z.object({
  hours: z.coerce.number().int().nonnegative(),
});

export type InternshipDocumentUploadInput = z.infer<
  typeof internshipDocumentUploadSchema
>;
export type ReviewInternshipDocumentInput = z.infer<
  typeof reviewInternshipDocumentSchema
>;
export type SetInternshipHoursInput = z.infer<typeof setInternshipHoursSchema>;
