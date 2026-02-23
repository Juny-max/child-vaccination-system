"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DatePicker } from "@/components/ui/date-picker"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ArrowLeft, Check } from "lucide-react"

const vaccines = [
  { id: "bcg", name: "BCG", doses: 1 },
  { id: "polio", name: "Polio", doses: 3 },
  { id: "dpt", name: "DPT", doses: 3 },
  { id: "mmr", name: "MMR", doses: 2 },
  { id: "yellow_fever", name: "Yellow Fever", doses: 1 },
  { id: "hepatitis_b", name: "Hepatitis B", doses: 3 },
]

export default function RecordVaccination() {
  const router = useRouter()
  const [childId, setChildId] = useState("")
  const [vaccineId, setVaccineId] = useState("")
  const [dose, setDose] = useState("")
  const [date, setDate] = useState("")
  const [batchNo, setBatchNo] = useState("")
  const [success, setSuccess] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSuccess(true)

    setTimeout(() => {
      router.push("/dashboard")
    }, 2000)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-muted/30">
        <header className="border-b border-border bg-background">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft size={16} />
                Back
              </Button>
            </Link>
          </div>
        </header>

        <main className="max-w-md mx-auto px-4 py-12">
          <Card>
            <CardHeader className="text-center pb-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="text-green-600" size={32} />
              </div>
              <CardTitle className="text-2xl">Vaccination Recorded!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertDescription>
                  Vaccination has been recorded and will sync automatically when online.
                </AlertDescription>
              </Alert>

              <Button onClick={() => router.push("/dashboard")} className="w-full">
                Return to Dashboard
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft size={16} />
              Back
            </Button>
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <Card>
          <CardHeader>
            <CardTitle>Record Vaccination</CardTitle>
            <CardDescription>Record a vaccine dose for a child</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="childId">Child ID/UUID</Label>
                <Input
                  id="childId"
                  placeholder="Search by name or UUID"
                  value={childId}
                  onChange={(e) => setChildId(e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="vaccine">Vaccine</Label>
                  <select
                    id="vaccine"
                    className="w-full px-3 py-2 border border-border rounded-md bg-background"
                    value={vaccineId}
                    onChange={(e) => setVaccineId(e.target.value)}
                    required
                  >
                    <option value="">Select vaccine</option>
                    {vaccines.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dose">Dose Number</Label>
                  <Input
                    id="dose"
                    type="number"
                    placeholder="1"
                    value={dose}
                    onChange={(e) => setDose(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="date">Date Given</Label>
                  <DatePicker
                    date={date ? new Date(`${date}T00:00:00`) : undefined}
                    onDateChange={(selectedDate) => {
                      if (!selectedDate) {
                        setDate("")
                        return
                      }
                      const year = selectedDate.getFullYear()
                      const month = String(selectedDate.getMonth() + 1).padStart(2, "0")
                      const day = String(selectedDate.getDate()).padStart(2, "0")
                      setDate(`${year}-${month}-${day}`)
                    }}
                    placeholder="Select date given"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="batchNo">Batch Number</Label>
                  <Input
                    id="batchNo"
                    placeholder="Batch #"
                    value={batchNo}
                    onChange={(e) => setBatchNo(e.target.value)}
                    required
                  />
                </div>
              </div>

              <Alert>
                <AlertDescription>
                  This record will be saved locally and synced to the server automatically when you have internet
                  connection.
                </AlertDescription>
              </Alert>

              <div className="flex gap-4">
                <Button type="submit" className="flex-1">
                  Record Vaccination
                </Button>
                <Link href="/dashboard" className="flex-1">
                  <Button variant="outline" className="w-full bg-transparent">
                    Cancel
                  </Button>
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
