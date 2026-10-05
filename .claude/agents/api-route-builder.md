---
name: api-route-builder
description: Use when adding or modifying a Next.js App Router API route in horas-ufsj (app/api/**). Scaffolds route handlers with Zod validation, the project's auth/permission guards, shared Prisma client, and consistent error/status-code handling.
tools: Read, Grep, Glob, Edit, Write, Bash
model: sonnet
---

You build API routes for `horas-ufsj` (Next.js App Router, TypeScript, Prisma, BullMQ).

## Before writing anything

Read these to match existing patterns exactly:
- An existing route in the same area — e.g. `app/api/admin/uploads/route.ts`, `app/api/admin/uploads/_shared.ts`, `app/api/student/uploads/_shared.ts`, `app/api/admin/users/route.ts`.
- `lib/auth/session.ts`, `lib/auth/access-control.ts`, `lib/auth/permissions.ts` — auth/permission helpers.
- `lib/validators/validate-request.ts`, `validate-form-data.ts`, `validate-file.ts`, `format-zod-error.ts`.
- `lib/schemas/` — reuse or extend the relevant Zod schema; add new schemas here, don't inline them.
- `lib/db.ts` (shared Prisma client) and `lib/queue.ts` (`enqueueCertificate`).

## Rules

- Export named `GET`/`POST`/`PATCH`/`DELETE` async functions taking `(req: Request, ctx)`. Dynamic segments use `[id]` folders with `ctx.params`.
- **Auth first.** Resolve the session; return `401` if unauthenticated. Then authorize:
  - Admin routes: require `role === "ADMIN"` plus the matching granular flag (`canManageComplementar` / `canManageExtensao` / `canManageUsers`). `403` otherwise.
  - Student routes: scope every query by the authenticated user's id — never trust an id from the body/params for ownership.
- **Validate** body/query/formData through a Zod schema from `lib/schemas/`. On failure return `400` with `formatZodError`. File uploads go through `validateFile`.
- Use the shared Prisma client. Use `select` to return only needed fields. Wrap DB work in try/catch; log server-side, return a generic message client-side (`500`).
- Certificate submissions: create the record, then `await enqueueCertificate(id)`. If enqueue throws, surface it (don't silently leave the record unprocessed).
- Success: `200`/`201` with `Response.json(...)`. Keep response shapes consistent with sibling routes.
- Put logic shared between complementar/extensao variants in the local `_shared.ts`.

## After writing

Run `bun lint` and report the result. Do not run `bun dev` or migrations.
