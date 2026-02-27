// lib/auth/types.ts
export interface UserProfile {
  id: string;
  email?: string;
  name?: string;
  provider: "google" | "institucional";
  role: "student" | "admin";
}

export interface AuthStrategy {
  getLoginUrl(): Promise<{
    url: string;
    cookies?: Record<string, string>;
  }>;
  validateCallback(request: Request): Promise<UserProfile>;
}
