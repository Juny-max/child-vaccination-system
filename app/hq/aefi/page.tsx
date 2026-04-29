"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle, ArrowLeft, BellRing, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getHqAefiReports, HqAefiReport } from "@/lib/api/hq-analytics"

const PRIORITY_FILTERS = ["All", "High", "Medium", "Low"] as const
type PriorityFilter = (typeof PRIORITY_FILTERS)[number]

export default function AefiPage() {
  const router = useRouter()
  const [reports, setReports] = useState<HqAefiReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<PriorityFilter>("All")

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const data = await getHqAefiReports(100)
        setReports(data)
      } catch (error) {
        console.error("Failed to load AEFI reports", error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const filtered = filter === "All" ? reports : reports.filter((r) => r.priority === filter)

  const priorityVariant = (p: string) =>
    p === "High" ? "destructive" : p === "Medium" ? "secondary" : "outline"

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => router.push("/hq/dashboard")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <BellRing className="h-5 w-5 text-primary" /> Adverse Events (AEFI)
            </h1>
            <p className="text-sm text-muted-foreground">All reported adverse events following immunisation</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap">
          {PRIORITY_FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f}
            </Button>
          ))}
        </div>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isLoading ? "Loading..." : `${filtered.length} report${filtered.length !== 1 ? "s" : ""}`}
            </CardTitle>
            <CardDescription>
              {filter === "All" ? "Showing all priorities" : `Filtered by ${filter} priority`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading reports...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <AlertCircle className="h-10 w-10 opacity-30" />
                <p>No {filter !== "All" ? filter.toLowerCase() + " priority " : ""}adverse events found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-muted/30 p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground">{item.child}</span>
                      <Badge variant={priorityVariant(item.priority)}>{item.priority}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {item.vaccine} • {item.branch}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-2">
                      Reported {new Date(item.reportedAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
