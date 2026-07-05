import type { ZodError } from "zod";

export function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "body",
    message: issue.message,
  }));
}
