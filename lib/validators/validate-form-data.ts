import type { z } from "zod";
import { formatZodError } from "./format-zod-error";

export type SchemaValidationResult<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      issues: Array<{ path: string; message: string }>;
    };

export function validateFormData<T extends z.ZodTypeAny>(
  formData: FormData,
  schema: T,
): SchemaValidationResult<z.infer<T>> {
  const payload: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    payload[key] = value;
  }

  const result = schema.safeParse(payload);
  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: "Validação do formulário falhou.",
    issues: formatZodError(result.error),
  };
}
