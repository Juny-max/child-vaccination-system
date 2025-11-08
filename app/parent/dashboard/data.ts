export type ChildInfo = {
  name: string
  id: string
  age: string
  birthWeight: string
  bloodType: string
  primaryFacility: string
}

export const childInfo: ChildInfo = {
  name: "Ama Asante",
  id: "CHILD-001",
  age: "18 months",
  birthWeight: "3.2 kg",
  bloodType: "O+",
  primaryFacility: "Accra Central Health Center",
}

export const healthReminders: string[] = [
  "Keep Ama hydrated and observe for any reactions within 24 hours after each shot.",
  "Carry the child health record booklet to every visit.",
  "Update the nurse if Ama shows signs of fever lasting more than 48 hours.",
]

export type VaccinationStatus = "Complete" | "On Track" | "Upcoming"

export type VaccinationRecord = {
  vaccine: string
  dose: string
  date: string
  status: VaccinationStatus
}

export const vaccinationRecords: VaccinationRecord[] = [
  { vaccine: "BCG", dose: "1/1", date: "Dec 5, 2024", status: "Complete" },
  { vaccine: "Polio", dose: "1/3", date: "Dec 5, 2024", status: "Complete" },
  { vaccine: "Polio", dose: "2/3", date: "Jan 20, 2025", status: "On Track" },
  { vaccine: "DPT", dose: "1/3", date: "Dec 19, 2024", status: "Complete" },
  { vaccine: "DPT", dose: "2/3", date: "Jan 20, 2025", status: "On Track" },
  { vaccine: "MMR", dose: "1/2", date: "Pending", status: "Upcoming" },
]

export type MissedVaccination = {
  vaccine: string
  due: string
  daysOverdue: number
}

export const missedVaccinations: MissedVaccination[] = [
  { vaccine: "Hepatitis B (3rd dose)", due: "Feb 12, 2025", daysOverdue: 14 },
  { vaccine: "Vitamin A Supplement", due: "Jan 28, 2025", daysOverdue: 29 },
]

export type Appointment = {
  title: string
  date: string
  time: string
  location: string
  notes: string
}

export const appointments: Appointment[] = [
  {
    title: "MMR vaccination",
    date: "March 5, 2025",
    time: "10:00 AM",
    location: "Accra Central Health Center",
    notes: "Arrive 15 minutes early for triage. Bring health record booklet.",
  },
  {
    title: "Nutrition counselling",
    date: "April 18, 2025",
    time: "9:30 AM",
    location: "Accra Central Health Center",
    notes: "Discuss Ama's dietary plan and growth chart with the nutritionist.",
  },
]

export type MotherDetails = {
  phone: string
  email: string
  address: string
  nextVisit: string
  primaryNurse: string
}

export const motherDetailsTemplate: MotherDetails = {
  phone: "+233 24 123 4567",
  email: "mother@example.com",
  address: "Accra - Ga Central",
  nextVisit: "March 5, 2025",
  primaryNurse: "Nurse Afua Mensah",
}

export const chatbotPrompts: string[] = [
  '"What should I expect after the MMR shot?"',
  '"Send me a reminder three days before the next vaccine."',
  '"How do I update Ama\'s allergy information?"',
]
