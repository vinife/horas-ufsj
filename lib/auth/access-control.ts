const INSTITUTIONAL_DOMAINS = ["ufsj.edu.br", "aluno.ufsj.edu.br"] as const

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

export function isInstitutionalEmail(email: string) {
  const normalized = normalizeEmail(email)
  const domain = normalized.split("@")[1]
  if (!domain) return false
  return INSTITUTIONAL_DOMAINS.includes(
    domain as (typeof INSTITUTIONAL_DOMAINS)[number],
  )
}

export function getMasterAdminEmails() {
  const raw = process.env.MASTER_ADMIN_EMAILS ?? ""
  if (!raw.trim()) return new Set<string>()

  return new Set(
    raw
      .split(",")
      .map((value) => normalizeEmail(value))
      .filter(Boolean),
  )
}

export function isMasterAdminEmail(email?: string | null) {
  if (!email) return false
  return getMasterAdminEmails().has(normalizeEmail(email))
}
