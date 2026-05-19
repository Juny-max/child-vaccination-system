/**
 * Strict vaccine cutoff rules.
 * Vaccines in this list cannot be administered once the child exceeds maxDays of age.
 * All other vaccines are catch-up eligible and should never be blocked.
 */
const STRICT_CUTOFFS: { pattern: RegExp; maxDays: number; label: string }[] = [
  {
    // Rotavirus-1, Rotavirus-2, Rota 1, Rota 2, Rotarix — hard cutoff at 8 months (224 days)
    pattern: /\brotavirus\b|\brota[-\s]?[12]?\b|\brotarix\b/i,
    maxDays: 224,
    label: "8 months",
  },
  {
    // OPV-0 / OPV 0 / Birth Polio only — NOT OPV-1/2/3
    pattern: /\bopv[-\s]?0\b|\bopv[-\s]?birth\b|\bbirth[-\s]?polio\b/i,
    maxDays: 14,
    label: "14 days",
  },
  {
    // BCG — cutoff at 1 year (365 days)
    pattern: /\bbcg\b/i,
    maxDays: 365,
    label: "1 year",
  },
]

/**
 * Returns the strict cutoff rule for a vaccine, or null if it is catch-up eligible.
 */
export function getVaccineCutoff(
  vaccineName: string,
): { maxDays: number; label: string } | null {
  for (const rule of STRICT_CUTOFFS) {
    if (rule.pattern.test(vaccineName)) return { maxDays: rule.maxDays, label: rule.label }
  }
  return null
}

/**
 * Returns true if a strict-cutoff vaccine's window has expired for this child.
 * Returns false for catch-up vaccines (no cutoff) or if DOB is unavailable.
 */
export function isVaccineCutoffExpired(
  vaccineName: string,
  dateOfBirth: string | null | undefined,
): boolean {
  if (!dateOfBirth) return false
  const cutoff = getVaccineCutoff(vaccineName)
  if (!cutoff) return false
  const ageInDays = Math.floor(
    (Date.now() - new Date(dateOfBirth).getTime()) / (1000 * 60 * 60 * 24),
  )
  return ageInDays > cutoff.maxDays
}
