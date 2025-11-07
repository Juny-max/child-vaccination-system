"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Users, TrendingUp, AlertTriangle, CheckCircle, Plus, LogOut } from "lucide-react"
import Link from "next/link"

// Mock data
const coverageData = [
  { vaccine: "BCG", coverage: 92 },
  { vaccine: "Polio", coverage: 88 },
  { vaccine: "DPT", coverage: 85 },
  { vaccine: "MMR", coverage: 80 },
  { vaccine: "Yellow Fever", coverage: 78 },
]

const dropoutData = [
  { vaccine: "BCG", rate: 8 },
  { vaccine: "Polio", rate: 12 },
  { vaccine: "DPT", rate: 15 },
  { vaccine: "MMR", rate: 20 },
]

const certificateData = [
  { name: "Issued", value: 892 },
  { name: "Eligible", value: 145 },
  { name: "Pending", value: 208 },
]

const COLORS = ["#10b981", "#3b82f6", "#f59e0b"]

export default function Dashboard() {
  const router = useRouter()
  const [userName, setUserName] = useState("")

  useEffect(() => {
    const token = localStorage.getItem("authToken")
    const role = localStorage.getItem("userRole")
    const name = localStorage.getItem("userName")

    if (!token) {
      router.push("/auth/staff-login")
      return
    }

    if (role !== "staff") {
      router.push("/parent/dashboard")
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
              <span className="font-semibold">Staff Dashboard</span>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Total Children</CardTitle>
                <Users className="text-primary" size={20} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">1,245</p>
              <p className="text-xs text-muted-foreground mt-1">↑ 12% from last month</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Fully Vaccinated</CardTitle>
                <CheckCircle className="text-green-600" size={20} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">892</p>
              <p className="text-xs text-muted-foreground mt-1">71.6% coverage rate</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Overdue Vaccines</CardTitle>
                <AlertTriangle className="text-orange-600" size={20} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">47</p>
              <p className="text-xs text-muted-foreground mt-1">Require follow-up</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">AEFI Reports</CardTitle>
                <AlertTriangle className="text-red-600" size={20} />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">3</p>
              <p className="text-xs text-muted-foreground mt-1">Under review</p>
            </CardContent>
          </Card>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link href="/dashboard/register-child">
            <Button className="w-full gap-2">
              <Plus size={18} />
              Register Child
            </Button>
          </Link>
          <Link href="/dashboard/record-vaccination">
            <Button className="w-full gap-2 bg-transparent" variant="outline">
              <CheckCircle size={18} />
              Record Vaccination
            </Button>
          </Link>
          <Link href="/dashboard/reports">
            <Button className="w-full gap-2 bg-transparent" variant="outline">
              <TrendingUp size={18} />
              View Reports
            </Button>
          </Link>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Coverage by Vaccine */}
          <Card>
            <CardHeader>
              <CardTitle>Vaccination Coverage</CardTitle>
              <CardDescription>Coverage percentage by vaccine type</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={coverageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="vaccine" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="coverage" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Dropout Rates */}
          <Card>
            <CardHeader>
              <CardTitle>Dropout Rates</CardTitle>
              <CardDescription>Dose 1 to 2 completion rates</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={dropoutData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="vaccine" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="rate" stroke="#ef4444" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Certificate Status */}
          <Card>
            <CardHeader>
              <CardTitle>Certificate Status</CardTitle>
              <CardDescription>Distribution of certificate issuance</CardDescription>
            </CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={certificateData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {certificateData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Latest actions in the system</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-2 h-2 rounded-full bg-green-600 mt-2" />
                  <div>
                    <p className="font-medium text-sm">Child registered</p>
                    <p className="text-xs text-muted-foreground">Ama Asante, Age 2 months</p>
                  </div>
                  <span className="text-xs text-muted-foreground ml-auto">2 min ago</span>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-2 h-2 rounded-full bg-blue-600 mt-2" />
                  <div>
                    <p className="font-medium text-sm">Vaccination recorded</p>
                    <p className="text-xs text-muted-foreground">BCG dose 1, Kwame Boateng</p>
                  </div>
                  <span className="text-xs text-muted-foreground ml-auto">15 min ago</span>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-2 h-2 rounded-full bg-purple-600 mt-2" />
                  <div>
                    <p className="font-medium text-sm">Certificate generated</p>
                    <p className="text-xs text-muted-foreground">Yaa Mensah completed all vaccines</p>
                  </div>
                  <span className="text-xs text-muted-foreground ml-auto">1 hour ago</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Alerts */}
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            47 children have overdue vaccinations. Review the follow-up list to ensure immunization targets are met.
          </AlertDescription>
        </Alert>
      </main>
    </div>
  )
}
