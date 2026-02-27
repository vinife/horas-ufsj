// lib/auth/strategies/cas-strategy.ts
import { AuthStrategy, UserProfile } from "../types";
import { XMLParser } from "fast-xml-parser";

export class CasStrategy implements AuthStrategy {
  private serviceUrl = `${process.env.NEXTAUTH_URL}/api/auth/institucional/callback`;
  private casBaseUrl = "https://balancer.ufsj.edu.br/sso-server";

  async getLoginUrl(): Promise<{
    url: string;
    cookies?: Record<string, string>;
  }> {
    return {
      url: `${this.casBaseUrl}/login?service=${encodeURIComponent(this.serviceUrl)}`,
    };
  }

  async validateCallback(request: Request): Promise<UserProfile> {
    const { searchParams } = new URL(request.url);
    const ticket = searchParams.get("ticket");

    if (!ticket) throw new Error("Ticket CAS não encontrado");

    const validateUrl = `${this.casBaseUrl}/serviceValidate?service=${encodeURIComponent(this.serviceUrl)}&ticket=${ticket}`;

    const res = await fetch(validateUrl);
    const text = await res.text();
    const parser = new XMLParser();
    const json = parser.parse(text);

    const success = json["cas:serviceResponse"]?.["cas:authenticationSuccess"];
    if (!success) throw new Error("Falha na validação CAS");

    return {
      id: success["cas:user"],
      provider: "institucional",
      // CAS muitas vezes não retorna nome/email por padrão, só o login
      name: success["cas:user"],
      role: "student",
    };
  }
}
