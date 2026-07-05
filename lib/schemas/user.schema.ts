import { z } from "zod";
import {
  emailSchema,
  pageNumberSchema,
  pageSizeSchema,
  safeSearchQuerySchema,
} from "./common.schema";

export const managedRoleSchema = z.enum(["ADMIN", "STUDENT"]);
export const managedAccessStatusSchema = z.enum([
  "PENDING",
  "APPROVED",
  "REJECTED",
]);

export const userListQuerySchema = z.object({
  q: safeSearchQuerySchema,
  page: pageNumberSchema,
  pageSize: pageSizeSchema,
  role: managedRoleSchema.optional(),
  accessStatus: managedAccessStatusSchema.optional(),
});

export const createUserSchema = z.object({
  email: emailSchema,
  role: managedRoleSchema.default("STUDENT"),
  name: z.string().trim().max(120).optional(),
});

export const updateUserStatusSchema = z.object({
  userId: z.string().trim().min(1),
  status: managedAccessStatusSchema,
  role: managedRoleSchema.optional(),
  canManageComplementar: z.boolean().optional(),
  canManageExtensao: z.boolean().optional(),
  canManageUsers: z.boolean().optional(),
  reason: z.string().trim().max(280).optional(),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserStatusInput = z.infer<typeof updateUserStatusSchema>;
export type UserListQueryInput = z.infer<typeof userListQuerySchema>;
