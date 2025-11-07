"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Download } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

const reportData = [
  { branch: "Accra Central", coverage: 88, overdue: 12, issued: 150 },
  { branch: "Tema", coverage: 85, overdue: 15, issued: 142 },
  { branch: "Ashaiman", coverage: 82, overdue: 18, issued: 138 },
  { branch: "Lartebiokorshie", coverage: 80, overdue: 20, issued: 130 },
]

export default function Reports() {
  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft size={16} />
              Back
            </Button>
          </Link>
          <Button className="gap-2">
            <Download size={16} />
            Export CSV
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Analytics Reports</h1>
          <p className="text-muted-foreground">Branch-level vaccination metrics and coverage analysis</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Coverage by Branch</CardTitle>
            <CardDescription>Vaccination coverage and performance metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={reportData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="branch" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="coverage" fill="#10b981" name="Coverage %" />
                <Bar dataKey="overdue" fill="#ef4444" name="Overdue" />
                <Bar dataKey="issued" fill="#3b82f6" name="Certificates Issued" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
