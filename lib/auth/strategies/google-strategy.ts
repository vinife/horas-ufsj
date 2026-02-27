// lib/auth/strategies/google-strategy.ts
import { AuthStrategy, UserProfile } from "../types";
import * as client from "openid-client";

export class GoogleStrategy implements AuthStrategy {
  private config: client.Configuration | null = null;

  private async getConfig() {
    if (this.config) return this.config;
    const issuer = new URL("https://accounts.google.com");
    this.config = await client.discovery(
      issuer,
      process.env.GOOGLE_CLIENT_ID!,
      {
        redirect_uris: [`${process.env.NEXTAUTH_URL}/api/auth/callback/google`],
        response_types: ["code"],
      },
      client.ClientSecretPost(process.env.GOOGLE_CLIENT_SECRET),
    );
    return this.config;
  }

  async getLoginUrl(): Promise<{
    url: string;
    cookies?: Record<string, string>;
  }> {
    const config = await this.getConfig();
    const code_verifier = client.randomPKCECodeVerifier();
    const code_challenge =
      await client.calculatePKCECodeChallenge(code_verifier);
    const state = client.randomState();
    let nonce: string | undefined;

    const parameters: Record<string, string> = {
      redirect_uri: `${process.env.NEXTAUTH_URL}/api/auth/callback/google`,
      scope: "openid email profile",
      code_challenge,
      code_challenge_method: "S256",
      state,
    };

    if (!config.serverMetadata().supportsPKCE()) {
      nonce = client.randomNonce();
      parameters.nonce = nonce;
    }

    const redirectTo = client.buildAuthorizationUrl(config, parameters);
    const cookies: Record<string, string> = {
      oauth_pkce_google: code_verifier,
      oauth_state_google: state,
    };
    if (nonce) cookies.oauth_nonce_google = nonce;

    return { url: redirectTo.href, cookies };
  }

  async validateCallback(request: Request): Promise<UserProfile> {
    const config = await this.getConfig();
    const cookies = parseCookies(request.headers.get("cookie") ?? "");
    const state = cookies["oauth_state_google"];
    const nonce = cookies["oauth_nonce_google"];
    const code_verifier = cookies["oauth_pkce_google"];
    if (!state || !code_verifier) {
      throw new Error("State/PKCE ausentes na autenticação Google");
    }

    const currentUrl = new URL(request.url);
    const tokenSet = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: code_verifier,
      expectedState: state,
      expectedNonce: nonce,
      idTokenExpected: true,
    });
    const claims = tokenSet.claims();
    const sub = claims?.sub;
    if (!sub) {
      throw new Error("ID Token sem subject");
    }

    const userinfo = await client.fetchUserInfo(
      config,
      tokenSet.access_token!,
      sub,
    );

    const email = userinfo.email?.toLowerCase();
    if (!email) {
      throw new Error("Email não encontrado no Google");
    }

    const domain = email.split("@")[1];
    const allowedDomains = ["aluno.ufsj.edu.br", "ufsj.edu.br"];
    if (!domain || !allowedDomains.includes(domain)) {
      throw new Error("Email institucional obrigatório");
    }

    if (userinfo.email_verified === false) {
      throw new Error("Email Google não verificado");
    }

    return {
      id: userinfo.sub ?? sub,
      email,
      name: userinfo.name,
      provider: "google",
      role: "student",
    };
  }
}

function parseCookies(cookieHeader: string) {
  const result: Record<string, string> = {};
  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) continue;
    const value = rest.join("=");
    result[rawKey] = decodeURIComponent(value);
  }
  return result;
}
