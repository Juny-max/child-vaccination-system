"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowLeft, CheckCircle2, Loader2, ServerCog, WifiOff } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getHqDeviceSyncStatus, HqDeviceSyncStatus } from "@/lib/api/hq-analytics"

const STATUS_FILTERS = ["All", "stale", "active"] as const
type StatusFilter = (typeof STATUS_FILTERS)[number]

export default function ChwSyncPage() {
  const router = useRouter()
  const [devices, setDevices] = useState<HqDeviceSyncStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>("All")

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const data = await getHqDeviceSyncStatus()
        setDevices(data)
      } catch (error) {
        console.error("Failed to load CHW sync status", error)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const filtered = filter === "All" ? devices : devices.filter((d) => d.status === filter)

  const staleCount = devices.filter((d) => d.status === "stale").length
  const activeCount = devices.filter((d) => d.status === "active").length

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
              <ServerCog className="h-5 w-5 text-primary" /> CHW Devices Pending Sync
            </h1>
            <p className="text-sm text-muted-foreground">Field data lag monitor — all community health workers</p>
          </div>
        </div>

        {/* Summary stats */}
        {!isLoading && (
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
              <p className="text-2xl font-bold">{devices.length}</p>
              <p className="text-xs text-muted-foreground">Total CHWs</p>
            </div>
            <div className="rounded-lg border border-border bg-red-50 dark:bg-red-900/20 p-3 text-center">
              <p className="text-2xl font-bold text-red-600">{staleCount}</p>
              <p className="text-xs text-muted-foreground">Stale</p>
            </div>
            <div className="rounded-lg border border-border bg-emerald-50 dark:bg-emerald-900/20 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex gap-2">
          {STATUS_FILTERS.map((f) => (
            <Button
              key={f}
              size="sm"
              variant={filter === f ? "default" : "outline"}
              onClick={() => setFilter(f)}
            >
              {f === "All" ? "All" : f === "stale" ? "Stale" : "Active"}
            </Button>
          ))}
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {isLoading ? "Loading..." : `${filtered.length} CHW${filtered.length !== 1 ? "s" : ""}`}
            </CardTitle>
            <CardDescription>
              Last sync time is based on last login activity recorded in the system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-muted-foreground">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading CHW data...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <CheckCircle2 className="h-10 w-10 opacity-30" />
                <p>No {filter !== "All" ? filter + " " : ""}CHW records found</p>
              </div>
            ) : (
              <div className="rounded-lg border border-border overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 border-b border-border">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium">CHW Name</th>
                      <th className="px-4 py-3 text-left font-medium">Branch</th>
                      <th className="px-4 py-3 text-center font-medium">Last Sync</th>
                      <th className="px-4 py-3 text-center font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((device) => (
                      <tr key={device.id} className={`border-b border-border hover:bg-muted/30 transition ${device.status === "stale" ? "bg-red-50/50 dark:bg-red-900/10" : ""}`}>
                        <td className="px-4 py-3 font-medium">{device.name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{device.branch}</td>
                        <td className="px-4 py-3 text-center text-muted-foreground">{device.lastSync}</td>
                        <td className="px-4 py-3 text-center">
                          {device.status === "stale" ? (
                            <Badge variant="destructive" className="gap-1">
                              <WifiOff className="h-3 w-3" /> Stale
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Active
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
