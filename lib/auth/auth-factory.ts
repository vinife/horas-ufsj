// lib/auth/auth-factory.ts
import { AuthStrategy } from "./types";
import { GoogleStrategy } from "./strategies/google-strategy";
import { CasStrategy } from "./strategies/cas-strategy";

export function getAuthStrategy(provider: string): AuthStrategy {
  switch (provider) {
    case "google":
      return new GoogleStrategy();
    case "institucional":
      return new CasStrategy();
    default:
      throw new Error(`Provedor ${provider} não suportado`);
  }
}
