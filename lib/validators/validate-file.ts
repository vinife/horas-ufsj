import type { z } from "zod";
import { formatZodError } from "./format-zod-error";
import type { SchemaValidationResult } from "./validate-form-data";

export function validateFile<T extends z.ZodTypeAny>(
  value: unknown,
  schema: T,
): SchemaValidationResult<z.infer<T>> {
  const result = schema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data };
  }

  return {
    success: false,
    error: "Validação de arquivo falhou.",
    issues: formatZodError(result.error),
  };
}
