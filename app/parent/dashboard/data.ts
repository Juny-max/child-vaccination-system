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
  name: "Esi Boadu",
  id: "CHILD-001",
  age: "18 months",
  height: "78 cm",
  birthWeight: "3.2 kg",
  bloodType: "O+",
  primaryFacility: "Accra Central Health Center",
  profilePhoto: "/images/demo-child-1.svg",
}

export type CertificateRecord = {
  certificateId: string
  childId: string
  childName: string
  issuedDate: string
  issuedBy: string
  completionStatus: "Complete" | "Partial"
  qrPayload: string
  vaccinesCompleted: string[]
  lastVerified: string
}

export const certificateRecords: CertificateRecord[] = [
  {
    certificateId: "CERT-GH-2025-001234",
    childId: childInfo.id,
    childName: childInfo.name,
    issuedDate: "October 12, 2025",
    issuedBy: "Accra Central Health Center",
    completionStatus: "Complete",
    qrPayload: "QRC-CERT-C9X4M7N2P5R8T1V6K3L0",
    vaccinesCompleted: [
      "BCG",
      "OPV0",
      "OPV1",
      "OPV2",
      "DPT1",
      "DPT2",
      "DPT3",
      "MR1",
      "Yellow Fever",
    ],
    lastVerified: "Nov 15, 2025 · 14:22 GMT",
  },
  {
    certificateId: "CERT-GH-2025-001567",
    childId: "CHILD-002",
    childName: "Kojo Asante",
    issuedDate: "September 02, 2025",
    issuedBy: "Accra Central Health Center",
    completionStatus: "Partial",
    qrPayload: "QRC-CERT-H6Q1Z8D4F7K2N5P9T3R0",
    vaccinesCompleted: [
      "BCG",
      "OPV0",
      "OPV1",
      "DPT1",
      "DPT2",
    ],
    lastVerified: "Awaiting completion",
  },
  {
    certificateId: "CERT-GH-2025-002045",
    childId: "CHILD-003",
    childName: "Zara Asante",
    issuedDate: "August 20, 2025",
    issuedBy: "Madina Community Clinic",
    completionStatus: "Complete",
    qrPayload: "QRC-CERT-P4V9M2X7L1C8R5N6D3T0",
    vaccinesCompleted: [
      "BCG",
      "OPV0",
      "OPV1",
      "OPV2",
      "DPT1",
      "DPT2",
      "DPT3",
      "PCV",
      "MR1",
    ],
    lastVerified: "Oct 28, 2025 · 09:10 GMT",
  },
]

export type ChildProfile = ChildInfo & {
  relationship: string
  dateOfBirth: string
}

export const childProfiles: ChildProfile[] = [
  {
    id: "CHILD-001",
    name: "Esi Boadu",
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
  {
    id: "CHILD-003",
    name: "Zara Asante",
    age: "3 years",
    height: "96 cm",
    dateOfBirth: "2022-01-14",
    relationship: "Eldest daughter",
    birthWeight: "3.4 kg",
    bloodType: "B+",
    primaryFacility: "Madina Community Clinic",
    profilePhoto: "/images/demo-child-1.svg",
  },
]

export const healthReminders: string[] = [
  "Keep your child hydrated and observe for any reactions within 24 hours after each shot.",
  "Have the child's digital health record ready for every visit.",
  "Update the nurse if your child shows signs of fever lasting more than 48 hours.",
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
    notes: "Arrive 15 minutes early for triage. Have the child's digital health record ready.",
  },
  {
    title: "Nutrition counselling",
    date: "April 18, 2025",
    time: "9:30 AM",
    location: "Accra Central Health Center",
    notes: "Discuss your child's dietary plan and growth chart with the nutritionist.",
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
    name: "Akua Serwaa",
    relationship: "Sister",
    phone: "+233 20 111 2233",
    isPrimary: false,
  },
]

export const chatbotPrompts: string[] = [
  '"What should I expect after the MMR shot?"',
  '"Send me a reminder three days before the next vaccine."',
  '"How do I update my child\'s allergy information?"',
]
