import { z } from "zod";

export const authProviderSchema = z.enum(["google", "institucional"]);
export type AuthProvider = z.infer<typeof authProviderSchema>;
