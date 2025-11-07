"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { LogOut, Download, Calendar } from "lucide-react"

export default function ParentDashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState("")

  useEffect(() => {
    const token = localStorage.getItem("authToken")
    const role = localStorage.getItem("userRole")
    const name = localStorage.getItem("userName")

    if (!token) {
      router.push("/auth/parent-login")
      return
    }

    if (role !== "parent") {
      router.push("/dashboard")
      return
    }

    setUserName(name || "User")
  }, [router])

  const handleLogout = () => {
    localStorage.removeItem("authToken")
    localStorage.removeItem("userRole")
    localStorage.removeItem("userName")
    router.push("/")
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">V</span>
              </div>
              <span className="font-semibold">My Child's Vaccines</span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-muted-foreground">Welcome, {userName}</span>
              <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2 bg-transparent">
                <LogOut size={16} />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Child Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Ama Asante</CardTitle>
            <CardDescription>Age: 18 months • ID: CHILD-001</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Vaccinations Completed</p>
                <p className="text-2xl font-bold">6 of 8</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Next Vaccine Due</p>
                <p className="text-2xl font-bold">MMR</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Certificate Status</p>
                <Badge>Not Yet Eligible</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Vaccination Records */}
        <Card>
          <CardHeader>
            <CardTitle>Vaccination Records</CardTitle>
            <CardDescription>Complete vaccination history</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { vaccine: "BCG", dose: "1/1", date: "Dec 5, 2024", status: "Complete" },
                { vaccine: "Polio", dose: "1/3", date: "Dec 5, 2024", status: "On Track" },
                { vaccine: "Polio", dose: "2/3", date: "Jan 20, 2025", status: "On Track" },
                { vaccine: "DPT", dose: "1/3", date: "Dec 19, 2024", status: "On Track" },
                { vaccine: "DPT", dose: "2/3", date: "Jan 20, 2025", status: "On Track" },
                { vaccine: "MMR", dose: "1/2", date: "Pending", status: "Upcoming" },
              ].map((record, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-4 border border-border rounded-lg hover:bg-muted/50 transition"
                >
                  <div>
                    <p className="font-medium">{record.vaccine}</p>
                    <p className="text-sm text-muted-foreground">Dose {record.dose}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">{record.date}</p>
                    <Badge variant={record.status === "Complete" ? "default" : "secondary"}>{record.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Certificate */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Digital Certificate</CardTitle>
            <CardDescription>Your child's official vaccination certificate</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-8 rounded-lg text-center">
              <p className="text-muted-foreground mb-4">
                Certificate will be available once all required vaccinations are completed.
              </p>
              <p className="text-sm text-muted-foreground mb-6">Progress: 6/8 vaccinations (75%)</p>
              <Button disabled className="gap-2">
                <Download size={16} />
                Download Certificate
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Appointments */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-muted rounded-lg">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                  <Calendar className="text-primary" size={20} />
                </div>
                <div>
                  <p className="font-medium">MMR Vaccination</p>
                  <p className="text-sm text-muted-foreground">March 5, 2025 at 10:00 AM</p>
                  <p className="text-xs text-muted-foreground mt-2">Accra Central Health Center</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
