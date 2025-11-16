import { jsPDF } from "jspdf"
import type { CertificateRecord } from "@/app/parent/dashboard/data"

type CertificatePdfOptions = {
  logoDataUrl?: string | null
  qrDataUrl?: string | null
}

export async function generateCertificatePdf(
  record: CertificateRecord,
  { logoDataUrl, qrDataUrl }: CertificatePdfOptions = {}
) {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const marginX = 56
  const headingOffsetX = marginX + 90
  const qrSize = 110
  const qrPositionY = 110
  let cursorY = 80

  if (logoDataUrl) {
    doc.addImage(logoDataUrl, "PNG", marginX, 30, 64, 64)
  }

  if (qrDataUrl) {
    doc.addImage(qrDataUrl, "PNG", pageWidth - marginX - qrSize, qrPositionY, qrSize, qrSize)
  }

  doc.setDrawColor(227, 233, 239)
  doc.roundedRect(marginX - 12, 24, pageWidth - marginX * 2 + 24, 520, 12, 12)

  doc.setFont("helvetica", "bold")
  doc.setFontSize(22)
  doc.text("Child Vaccination Certificate", headingOffsetX, cursorY)
  cursorY += 30

  const details = [
    { label: "Certificate ID", value: record.certificateId },
    { label: "Child", value: `${record.childName} (${record.childId})` },
    { label: "Issued", value: record.issuedDate },
    { label: "Facility", value: record.issuedBy },
  ]

  doc.setFontSize(12)
  doc.setFont("helvetica", "normal")
  details.forEach((detail) => {
    doc.text(`${detail.label}:`, marginX, cursorY)
    doc.setFont("helvetica", "bold")
    doc.text(detail.value, marginX + 140, cursorY)
    doc.setFont("helvetica", "normal")
    cursorY += 22
  })

  doc.text(`Completion Status: ${record.completionStatus}`, marginX, cursorY)
  cursorY += 30

  doc.setFont("helvetica", "bold")
  doc.text("Vaccines Recorded", marginX, cursorY)
  cursorY += 18
  doc.setFont("helvetica", "normal")

  record.vaccinesCompleted.forEach((vaccine) => {
    doc.text(`• ${vaccine}`, marginX + 10, cursorY)
    cursorY += 18
  })

  cursorY += 10
  doc.setFontSize(10)
  doc.text(`Last verified: ${record.lastVerified}`, marginX, cursorY)

  doc.save(`${record.certificateId}.pdf`)
}
