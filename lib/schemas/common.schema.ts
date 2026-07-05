import { z } from "zod";

export const trimmedString = z.string().trim();
export const nonEmptyString = trimmedString.min(1, {
  message: "Campo obrigatório.",
});
export const emailSchema = trimmedString
  .email({ message: "Email inválido." })
  .max(320, { message: "Email muito longo." });

export const safeSearchQuerySchema = trimmedString
  .max(100)
  .optional()
  .default("");

const parseNumberLike = (value: unknown) => {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized === "" ? undefined : Number(normalized);
  }
  return value;
};

export const pageNumberSchema = z.preprocess(
  parseNumberLike,
  z.number().int().min(1).default(1),
);
export const pageSizeSchema = z.preprocess(
  parseNumberLike,
  z.number().int().min(1).max(100).default(10),
);
