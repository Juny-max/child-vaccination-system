export type ChildInfo = {
  name: string
  id: string
  age: string
  height: string
  birthWeight: string
  bloodType: string
  primaryFacility: string
  profilePhoto: string
}

export const childInfo: ChildInfo = {
  name: "Ama Asante",
  id: "CHILD-001",
  age: "18 months",
  height: "78 cm",
  birthWeight: "3.2 kg",
  bloodType: "O+",
  primaryFacility: "Accra Central Health Center",
  profilePhoto: "/images/demo-child-1.svg",
}

export type ChildProfile = ChildInfo & {
  relationship: string
  dateOfBirth: string
}

export const childProfiles: ChildProfile[] = [
  {
    id: "CHILD-001",
    name: "Ama Asante",
  age: "18 months",
  height: "78 cm",
    dateOfBirth: "2023-05-10",
    relationship: "First daughter",
    birthWeight: "3.2 kg",
    bloodType: "O+",
    primaryFacility: "Accra Central Health Center",
  profilePhoto: "/images/demo-child-1.svg",
  },
  {
    id: "CHILD-002",
    name: "Kojo Asante",
  age: "6 months",
  height: "66 cm",
    dateOfBirth: "2024-04-21",
    relationship: "Second son",
    birthWeight: "3.0 kg",
    bloodType: "A+",
    primaryFacility: "Accra Central Health Center",
  profilePhoto: "/images/demo-child-2.svg",
  },
]

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

export type ContactMethod = "phone" | "sms" | "whatsapp" | "email"

export type MotherDetails = {
  name: string
  primaryPhone: string
  secondaryPhone?: string
  email: string
  addressLine1: string
  landmark?: string
  city: string
  region: string
  country: string
  postalCode?: string
  preferredContactMethod: ContactMethod
  nextVisit: string
  primaryNurse: string
}

export const motherDetailsTemplate: MotherDetails = {
  name: "Akosua Asante",
  primaryPhone: "+233 24 123 4567",
  secondaryPhone: "+233 20 765 4321",
  email: "akosua.asante@example.com",
  addressLine1: "House 12, Mango Street",
  landmark: "Near Ga Central Clinic",
  city: "Accra",
  region: "Greater Accra",
  country: "Ghana",
  postalCode: "GA-184-5123",
  preferredContactMethod: "sms",
  nextVisit: "March 5, 2025",
  primaryNurse: "Nurse Afua Mensah",
}

export type EmergencyContact = {
  id: string
  name: string
  relationship: string
  phone: string
  isPrimary: boolean
}

export const emergencyContactsTemplate: EmergencyContact[] = [
  {
    id: "CONTACT-001",
    name: "Kwame Asante",
    relationship: "Father",
    phone: "+233 24 555 8899",
    isPrimary: true,
  },
  {
    id: "CONTACT-002",
    name: "Ama Serwaa",
    relationship: "Sister",
    phone: "+233 20 111 2233",
    isPrimary: false,
  },
]

export const chatbotPrompts: string[] = [
  '"What should I expect after the MMR shot?"',
  '"Send me a reminder three days before the next vaccine."',
  '"How do I update Ama\'s allergy information?"',
]
