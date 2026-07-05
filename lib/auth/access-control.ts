const DOMAIN_ROLE_MAP = {
  "ufsj.edu.br": "ADMIN",
  "aluno.ufsj.edu.br": "STUDENT",
} as const;

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isInstitutionalEmail(email: string) {
  const normalized = normalizeEmail(email);
  const domain = normalized.split("@")[1];
  if (!domain) return false;
  return domain in DOMAIN_ROLE_MAP;
}

export function getUserTypeFromEmail(email: string) {
  const normalized = normalizeEmail(email);
  const domain = normalized.split("@")[1];

  if (!domain) return null;

  if (domain in DOMAIN_ROLE_MAP) {
    return DOMAIN_ROLE_MAP[domain as keyof typeof DOMAIN_ROLE_MAP];
  }

  return null;
}
