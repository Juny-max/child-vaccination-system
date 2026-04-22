// Ghana's Expanded Programme on Immunization (EPI) Schedule
// Based on Ghana Health Service guidelines

export type VaccineRoute = "intramuscular" | "intradermal" | "subcutaneous" | "oral"
export type InjectionSite = "right-arm" | "left-arm" | "right-thigh" | "left-thigh" | "oral"

export interface VaccineDetails {
  name: string
  abbreviation: string
  route: VaccineRoute
  site: InjectionSite | InjectionSite[] // Array if site alternates
  ageWeeks: number[]
  doses: number
  description: string
}

export const GHANA_EPI_VACCINES: Record<string, VaccineDetails> = {
  BCG: {
    name: "BCG (Bacille Calmette-Guérin)",
    abbreviation: "BCG",
    route: "intradermal",
    site: "right-arm",
    ageWeeks: [0], // Birth
    doses: 1,
    description: "Protection against tuberculosis",
  },
  "OPV": {
    name: "Oral Polio Vaccine",
    abbreviation: "OPV",
    route: "oral",
    site: "oral",
    ageWeeks: [0, 6, 10, 14], // Birth, 6, 10, 14 weeks
    doses: 4,
    description: "Protection against poliomyelitis",
  },
  "HEPATITIS-B": {
    name: "Hepatitis B",
    abbreviation: "HepB",
    route: "intramuscular",
    site: ["right-thigh", "left-thigh"],
    ageWeeks: [0, 6, 10],
    doses: 3,
    description: "Protection against hepatitis B virus",
  },
  "PENTAVALENT": {
    name: "Pentavalent (DPT/HiB/HepB)",
    abbreviation: "Penta",
    route: "intramuscular",
    site: ["right-thigh", "left-thigh"],
    ageWeeks: [6, 10, 14],
    doses: 3,
    description: "Protection against diphtheria, pertussis, tetanus, Haemophilus influenzae, hepatitis B",
  },
  "PCV": {
    name: "Pneumococcal Conjugate Vaccine",
    abbreviation: "PCV",
    route: "intramuscular",
    site: ["right-thigh", "left-thigh"],
    ageWeeks: [6, 10, 14],
    doses: 3,
    description: "Protection against pneumococcal infections",
  },
  "ROTAVIRUS": {
    name: "Rotavirus Vaccine",
    abbreviation: "Rota",
    route: "oral",
    site: "oral",
    ageWeeks: [6, 10],
    doses: 2,
    description: "Protection against rotavirus diarrhea",
  },
  "MEASLES": {
    name: "Measles-Rubella",
    abbreviation: "MR",
    route: "subcutaneous",
    site: ["left-arm", "right-arm"],
    ageWeeks: [36, 72], // 9 months, 18 months
    doses: 2,
    description: "Protection against measles and rubella",
  },
  "YELLOW-FEVER": {
    name: "Yellow Fever Vaccine",
    abbreviation: "YF",
    route: "intramuscular",
    site: "left-arm",
    ageWeeks: [36], // 9 months
    doses: 1,
    description: "Protection against yellow fever",
  },
  "MENINGITIS-A": {
    name: "Meningitis A Vaccine",
    abbreviation: "MenA",
    route: "intramuscular",
    site: "right-arm",
    ageWeeks: [72], // 18 months
    doses: 1,
    description: "Protection against meningitis A",
  },
}

// Map of vaccine name variations to standard names
export const VACCINE_NAME_ALIASES: Record<string, string> = {
  "BCG": "BCG",
  "OPV": "OPV",
  "OPV 0": "OPV",
  "Polio": "OPV",
  "Hepatitis B": "HEPATITIS-B",
  "HepB": "HEPATITIS-B",
  "Pentavalent": "PENTAVALENT",
  "Penta": "PENTAVALENT",
  "DPT": "PENTAVALENT",
  "PCV": "PCV",
  "Pneumococcal": "PCV",
  "Rotavirus": "ROTAVIRUS",
  "Rota": "ROTAVIRUS",
  "Measles": "MEASLES",
  "MR": "MEASLES",
  "Measles-Rubella": "MEASLES",
  "Yellow Fever": "YELLOW-FEVER",
  "YF": "YELLOW-FEVER",
  "Meningitis A": "MENINGITIS-A",
  "MenA": "MENINGITIS-A",
}

/**
 * Get the recommended injection site for a vaccine dose
 * @param vaccineName - Name of the vaccine
 * @param doseNumber - Which dose (1st, 2nd, 3rd, etc.) - starts at 1
 * @returns The injection site or null if vaccine not found
 */
export function getVaccineSite(vaccineName: string, doseNumber: number = 1): InjectionSite | null {
  const standardName = VACCINE_NAME_ALIASES[vaccineName] || vaccineName
  const vaccine = GHANA_EPI_VACCINES[standardName]

  if (!vaccine) return null

  const site = vaccine.site
  if (Array.isArray(site)) {
    // Alternate between sites for multiple doses
    // For thighs: dose 1 = right, dose 2 = left, dose 3 = right, etc.
    // For arms: dose 1 = left, dose 2 = right, etc.
    return site[(doseNumber - 1) % site.length]
  }

  return site
}

/**
 * Get user-friendly site description
 */
export function getSiteDescription(site: InjectionSite): string {
  const descriptions: Record<InjectionSite, string> = {
    "right-arm": "Right upper arm",
    "left-arm": "Left upper arm",
    "right-thigh": "Right upper thigh",
    "left-thigh": "Left upper thigh",
    "oral": "By mouth (oral)",
  }
  return descriptions[site] || site
}

/**
 * Get all Ghana EPI vaccines as an array
 */
export function getGhanaEPIVaccines() {
  return Object.values(GHANA_EPI_VACCINES)
}

/**
 * Get vaccine details by name
 */
export function getVaccineDetails(vaccineName: string): VaccineDetails | null {
  const standardName = VACCINE_NAME_ALIASES[vaccineName] || vaccineName
  return GHANA_EPI_VACCINES[standardName] || null
}
