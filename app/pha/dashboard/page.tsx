"use client"

import { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { 
  Activity, 
  BarChart3, 
  Calendar, 
  FileText, 
  MapPin, 
  ShieldCheck, 
  TrendingUp, 
  Users,
  AlertTriangle,
  Download,
  Filter,
  LogOut
} from "lucide-react"
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
  Legend, 
  ResponsiveContainer 
} from "recharts"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ThemeToggle } from "@/components/theme-toggle"

// Mock data for national KPIs
const nationalKPIs = {
  totalChildrenRegistered: 2847621,
  totalDosesAdministered: 8542864,
  measlesCoverage: 87.4,
  dropoutRate: 12.3,
}

// Coverage trend data (monthly for last 12 months)
const coverageTrendData = [
  { month: "Dec 2024", coverage: 82.1 },
  { month: "Jan 2025", coverage: 83.5 },
  { month: "Feb 2025", coverage: 84.2 },
  { month: "Mar 2025", coverage: 85.1 },
  { month: "Apr 2025", coverage: 85.8 },
  { month: "May 2025", coverage: 86.3 },
  { month: "Jun 2025", coverage: 86.9 },
  { month: "Jul 2025", coverage: 87.2 },
  { month: "Aug 2025", coverage: 87.5 },
  { month: "Sep 2025", coverage: 87.8 },
  { month: "Oct 2025", coverage: 88.1 },
  { month: "Nov 2025", coverage: 87.4 },
]

// Regional performance data (All 16 regions of Ghana)
const regionalPerformanceData = [
  { region: "Greater Accra", coverage: 91.2, population: 520000 },
  { region: "Ashanti", coverage: 89.4, population: 680000 },
  { region: "Western", coverage: 85.7, population: 380000 },
  { region: "Eastern", coverage: 84.3, population: 420000 },
  { region: "Central", coverage: 87.1, population: 350000 },
  { region: "Volta", coverage: 83.5, population: 290000 },
  { region: "Northern", coverage: 79.2, population: 450000 },
  { region: "Upper East", coverage: 76.8, population: 210000 },
  { region: "Upper West", coverage: 74.5, population: 180000 },
  { region: "Bono", coverage: 82.9, population: 320000 },
  { region: "Bono East", coverage: 81.4, population: 280000 },
  { region: "Ahafo", coverage: 80.6, population: 195000 },
  { region: "Western North", coverage: 84.1, population: 225000 },
  { region: "Savannah", coverage: 77.3, population: 270000 },
  { region: "North East", coverage: 75.9, population: 185000 },
  { region: "Oti", coverage: 82.2, population: 240000 },
]

// AEFI reports by type and region (aggregate surveillance)
const aefiReportsData = [
  { type: "Fever", count: 1243, severity: "Mild" },
  { type: "Injection Site Reaction", count: 892, severity: "Mild" },
  { type: "Rash", count: 456, severity: "Mild" },
  { type: "Swelling", count: 334, severity: "Moderate" },
  { type: "Allergic Reaction", count: 89, severity: "Moderate" },
  { type: "Severe Allergic", count: 12, severity: "Severe" },
]

const aefiByRegionData = [
  { region: "Greater Accra", count: 478 },
  { region: "Ashanti", count: 423 },
  { region: "Western", count: 267 },
  { region: "Eastern", count: 312 },
  { region: "Central", count: 245 },
  { region: "Volta", count: 189 },
  { region: "Northern", count: 356 },
  { region: "Upper East", count: 178 },
  { region: "Upper West", count: 134 },
  { region: "Bono", count: 234 },
  { region: "Bono East", count: 198 },
  { region: "Ahafo", count: 156 },
  { region: "Western North", count: 187 },
  { region: "Savannah", count: 223 },
  { region: "North East", count: 145 },
  { region: "Oti", count: 201 },
]

const COLORS = {
  primary: "#3b82f6",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  purple: "#a855f7",
  teal: "#14b8a6",
}

const PIE_COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6"]

export default function PHADashboard() {
  const [selectedTimeRange, setSelectedTimeRange] = useState("12months")
  const router = useRouter()

  const handleLogout = () => {
    try {
      const keysToClear = [
        "authToken",
        "userRole",
        "userProfile",
        "phaSession",
        "selectedFacility",
      ]

      keysToClear.forEach((key) => {
        if (typeof window !== "undefined") {
          localStorage.removeItem(key)
        }
      })

      if (typeof window !== "undefined") {
        localStorage.removeItem("persist:root")
      }
    } catch (error) {
      console.error("Failed to clear session", error)
    } finally {
      router.replace("/auth/login")
    }
  }

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat("en-GH").format(num)
  }

  return (
    <div className="min-h-screen bg-muted/20">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="mx-auto max-w-[1600px] px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-primary/30 bg-primary/5">
                <Image src="/images/cvcc-logo.png" alt="System logo" fill sizes="40px" className="object-cover" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">National Health Dashboard</h1>
                <p className="text-sm text-muted-foreground">Public Health Authority</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <Link href="/pha/reports">
                <Button variant="outline" className="gap-2">
                  <FileText className="h-4 w-4" /> Reports & Exports
                </Button>
              </Link>
              <Link href="/pha/verify-certificate">
                <Button variant="outline" className="gap-2">
                  <ShieldCheck className="h-4 w-4" /> Verify Certificate
                </Button>
              </Link>
              <Button variant="destructive" className="gap-2" onClick={handleLogout}>
                <LogOut className="h-4 w-4" /> Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-8">
        {/* National KPI Cards */}
        <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950 dark:to-blue-900/20">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                <Users className="h-4 w-4" /> Total Children Registered
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                {formatNumber(nationalKPIs.totalChildrenRegistered)}
              </div>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-400">Nationwide · All-time</p>
            </CardContent>
          </Card>

          <Card className="border-green-200 bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950 dark:to-green-900/20">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <Activity className="h-4 w-4" /> Total Doses Administered
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-900 dark:text-green-100">
                {formatNumber(nationalKPIs.totalDosesAdministered)}
              </div>
              <p className="mt-1 text-xs text-green-700 dark:text-green-400">All vaccines · All-time</p>
            </CardContent>
          </Card>

          <Card className="border-purple-200 bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950 dark:to-purple-900/20">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <TrendingUp className="h-4 w-4" /> Measles Coverage (MR1)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-900 dark:text-purple-100">
                {nationalKPIs.measlesCoverage}%
              </div>
              <p className="mt-1 text-xs text-purple-700 dark:text-purple-400">National · Current month</p>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950 dark:to-amber-900/20">
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="h-4 w-4" /> Dropout Rate (DPT1→DPT3)
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                {nationalKPIs.dropoutRate}%
              </div>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">Needs attention · Target: &lt;10%</p>
            </CardContent>
          </Card>
        </section>

        {/* Coverage Over Time (Line Chart) */}
        <section className="grid gap-6 lg:grid-cols-2">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-primary" /> National Coverage Trend
              </CardTitle>
              <CardDescription>Vaccination coverage percentage · Last 12 months</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={coverageTrendData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="month" 
                    className="text-xs" 
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    domain={[70, 95]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="coverage" 
                    stroke={COLORS.primary} 
                    strokeWidth={3}
                    name="Coverage %"
                    dot={{ fill: COLORS.primary, r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="mt-4 text-xs text-muted-foreground">
                📈 Trend: Steady improvement from 82.1% (Dec 2024) to 87.4% (Nov 2025)
              </p>
            </CardContent>
          </Card>

          {/* AEFI Reports by Type (Pie Chart) */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> AEFI Reports (Surveillance)
              </CardTitle>
              <CardDescription>Adverse events by type · National aggregate</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={aefiReportsData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={(entry) => `${entry.type}: ${entry.count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {aefiReportsData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">
                  {aefiReportsData.filter(e => e.severity === "Mild").reduce((acc, e) => acc + e.count, 0)} Mild
                </Badge>
                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300">
                  {aefiReportsData.filter(e => e.severity === "Moderate").reduce((acc, e) => acc + e.count, 0)} Moderate
                </Badge>
                <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300">
                  {aefiReportsData.filter(e => e.severity === "Severe").reduce((acc, e) => acc + e.count, 0)} Severe
                </Badge>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Regional Performance (Bar Chart) */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <MapPin className="h-5 w-5 text-primary" /> Regional Performance Comparison
              </CardTitle>
              <CardDescription>Vaccination coverage rates by region · Identifies high and low performers</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={500}>
                <BarChart data={regionalPerformanceData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="region" 
                    className="text-xs" 
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    angle={-45}
                    textAnchor="end"
                    height={120}
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    domain={[60, 100]}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number, name: string) => {
                      if (name === "coverage") return [`${value}%`, "Coverage"]
                      if (name === "population") return [formatNumber(value), "Population"]
                      return [value, name]
                    }}
                  />
                  <Legend />
                  <Bar 
                    dataKey="coverage" 
                    fill={COLORS.primary} 
                    name="Coverage %"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 dark:bg-green-950/20">
                  <p className="text-xs font-medium text-green-700 dark:text-green-400">🏆 Top Performer</p>
                  <p className="text-sm font-bold text-green-900 dark:text-green-100">Greater Accra · 91.2%</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:bg-amber-950/20">
                  <p className="text-xs font-medium text-amber-700 dark:text-amber-400">📊 National Average</p>
                  <p className="text-sm font-bold text-amber-900 dark:text-amber-100">83.5%</p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:bg-red-950/20">
                  <p className="text-xs font-medium text-red-700 dark:text-red-400">⚠️ Needs Support</p>
                  <p className="text-sm font-bold text-red-900 dark:text-red-100">Upper West · 74.5%</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* AEFI by Region (Bar Chart) */}
        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <BarChart3 className="h-5 w-5 text-amber-500" /> AEFI Reports by Region
              </CardTitle>
              <CardDescription>Regional distribution of adverse events · For surveillance and anomaly detection</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={450}>
                <BarChart data={aefiByRegionData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="region" 
                    className="text-xs" 
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    angle={-45}
                    textAnchor="end"
                    height={120}
                  />
                  <YAxis 
                    className="text-xs" 
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--background))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }}
                    formatter={(value: number) => [`${value} reports`, "AEFI Count"]}
                  />
                  <Legend />
                  <Bar 
                    dataKey="count" 
                    fill={COLORS.warning} 
                    name="AEFI Reports"
                    radius={[8, 8, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              <p className="mt-4 text-xs text-muted-foreground">
                ℹ️ No unusual clusters detected. All regions reporting within expected ranges based on population.
              </p>
            </CardContent>
          </Card>
        </section>

        {/* Quick Actions */}
        <section className="grid gap-4 md:grid-cols-3">
          <Link href="/pha/reports">
            <Card className="cursor-pointer border-primary/40 transition-all hover:border-primary hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-5 w-5 text-primary" /> Generate Reports
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Export national coverage, dropout, and stock utilization reports in CSV, Excel, or PDF format.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Link href="/pha/verify-certificate">
            <Card className="cursor-pointer border-primary/40 transition-all hover:border-primary hover:shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ShieldCheck className="h-5 w-5 text-green-600" /> Verify Certificate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Anti-fraud tool: Verify digital vaccination certificates by ID or QR code scan.
                </p>
              </CardContent>
            </Card>
          </Link>

          <Card className="border-muted">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Download className="h-5 w-5 text-muted-foreground" /> Data Exports
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Last export: Nov 15, 2025 · WHO Monthly Report
              </p>
              <Button variant="outline" size="sm" className="mt-3 w-full">
                View Export History
              </Button>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  )
}
