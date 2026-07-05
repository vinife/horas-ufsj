import { NextResponse } from "next/server";
import type { z } from "zod";
import { formatZodError } from "./format-zod-error";

export async function validateJsonRequest<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
): Promise<z.infer<T> | Response> {
  const body = await request.json().catch(() => null);
  const result = schema.safeParse(body);
  if (result.success) {
    return result.data;
  }

  return NextResponse.json(
    {
      error: "Validação de requisição falhou.",
      issues: formatZodError(result.error),
    },
    { status: 422 },
  );
}

export function validateQueryParams<T extends z.ZodTypeAny>(
  searchParams: URLSearchParams,
  schema: T,
): z.infer<T> | Response {
  const payload = Object.fromEntries(searchParams.entries());
  const result = schema.safeParse(payload);
  if (result.success) {
    return result.data;
  }

  return NextResponse.json(
    {
      error: "Parâmetros inválidos.",
      issues: formatZodError(result.error),
    },
    { status: 422 },
  );
}

export function validateRouteParams<T extends z.ZodTypeAny>(
  params: Record<string, string | string[] | undefined>,
  schema: T,
): z.infer<T> | Response {
  const normalized = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] : value,
    ]),
  );
  const result = schema.safeParse(normalized);
  if (result.success) {
    return result.data;
  }

  return NextResponse.json(
    {
      error: "Parâmetros de rota inválidos.",
      issues: formatZodError(result.error),
    },
    { status: 422 },
  );
}
