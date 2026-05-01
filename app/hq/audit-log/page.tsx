"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Activity,
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  Globe2,
  Loader2,
  Search,
  ServerCog,
  Shield,
  Users as UsersIcon,
  X,
} from "lucide-react"

import { ThemeToggle } from "@/components/theme-toggle"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { getHqAuditLogs, HqAuditLog } from "@/lib/api/hq-audit-logs"
import { getHqUsers } from "@/lib/api/hq-users"

const PAGE_SIZE = 20

const CATEGORY_COLOURS: Record<string, string> = {
  Authentication: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  "User Management": "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  "Branch Operations": "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  "Vaccine Management": "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  "System Changes": "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  Notifications: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  "Child Records": "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  "Guardian Records": "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
  Auth: "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400",
  User: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
  Branch: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400",
  Vaccine: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400",
  System: "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400",
  Notification: "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-400",
  Child: "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-400",
  Guardian: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400",
}

const CATEGORY_ALIASES: Record<string, string> = {
  auth: "Authentication",
  authentication: "Authentication",
  user: "User Management",
  users: "User Management",
  branch: "Branch Operations",
  branches: "Branch Operations",
  vaccine: "Vaccine Management",
  vaccines: "Vaccine Management",
  system: "System Changes",
  notification: "Notifications",
  notifications: "Notifications",
  child: "Child Records",
  children: "Child Records",
  guardian: "Guardian Records",
  guardians: "Guardian Records",
  parent: "Guardian Records",
  parents: "Guardian Records",
}

function categoryLabel(category: string) {
  const normalized = category.trim().toLowerCase()
  return CATEGORY_ALIASES[normalized] ?? category
}

function categoryClass(category: string) {
  const label = categoryLabel(category)
  return CATEGORY_COLOURS[label] ?? "bg-muted text-muted-foreground"
}

function actionIcon(action: string) {
  const lower = action.toLowerCase()
  if (lower.includes("login") || lower.includes("logout") || lower.includes("auth")) return Shield
  if (lower.includes("user") || lower.includes("password")) return UsersIcon
  if (lower.includes("branch") || lower.includes("chw")) return ServerCog
  if (lower.includes("vaccine") || lower.includes("schedule")) return Activity
  return Globe2
}

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function parseUA(ua?: string) {
  if (!ua) return null
  const browser = ua.match(/(Chrome|Firefox|Safari|Edge|Opera)\/[\d.]+/)?.[0]
  const os = ua.match(/\(([^)]+)\)/)?.[1]?.split(";")[0]
  return [browser, os].filter(Boolean).join(" · ") || ua.slice(0, 60)
}

type EnrichedLog = HqAuditLog & { actorName?: string }

export default function HqAuditLogPage() {
  const router = useRouter()
  const [logs, setLogs] = useState<EnrichedLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [totalReturned, setTotalReturned] = useState(0)
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState("")
  const [categoryFilter, setCategoryFilter] = useState("")
  const [selected, setSelected] = useState<EnrichedLog | null>(null)

  const loadLogs = useCallback(async (offset: number) => {
    setIsLoading(true)
    try {
      const [logsRes, usersRes] = await Promise.all([
        getHqAuditLogs({ limit: PAGE_SIZE, offset }),
        getHqUsers(),
      ])
      const nameMap = new Map<string, string>()
      for (const u of usersRes) nameMap.set(u.id, u.name)

      const enriched: EnrichedLog[] = (logsRes.data ?? []).map((log) => ({
        ...log,
        actorName: log.userName ?? nameMap.get(log.userId) ?? log.userId,
      }))
      setLogs(enriched)
      setTotalReturned(logsRes.pagination?.returned ?? enriched.length)
    } catch (err) {
      console.error("Failed to load audit logs", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")
    if (role !== "staff" || detail !== "hq-admin") {
      router.push("/dashboard")
      return
    }
    loadLogs(page * PAGE_SIZE)
  }, [page, loadLogs, router])

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return logs.filter((log) => {
      const matchSearch =
        !q ||
        log.action.toLowerCase().includes(q) ||
        (log.actorName ?? "").toLowerCase().includes(q) ||
        (log.category ?? "").toLowerCase().includes(q) ||
        (log.entityType ?? "").toLowerCase().includes(q) ||
        (log.ipAddress ?? "").includes(q)
      const matchCategory = !categoryFilter || log.category === categoryFilter
      return matchSearch && matchCategory
    })
  }, [logs, search, categoryFilter])

  const categories = useMemo(
    () => Array.from(new Set(logs.map((l) => l.category).filter(Boolean))).sort(),
    [logs],
  )

  const distinctUserCount = useMemo(() => {
    const ids = logs
      .map((log) => log.userId || log.userName || log.actorName)
      .filter((value): value is string => Boolean(value))
    return new Set(ids).size
  }, [logs])

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild className="gap-2">
              <Link href="/hq/dashboard?section=system">
                <ChevronLeft className="h-4 w-4" /> Back to System Health
              </Link>
            </Button>
            <div className="h-5 w-px bg-border" />
            <div>
              <p className="text-sm font-semibold text-foreground">System Audit Log</p>
              <p className="text-xs text-muted-foreground">Full activity trail — every user action, timestamped and attributed</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats strip */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{logs.length}</p>
                <p className="text-xs text-muted-foreground">Entries this page</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 dark:bg-violet-950/40">
                <UsersIcon className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">
                  {distinctUserCount}
                </p>
                <p className="text-xs text-muted-foreground">Unique people on this page</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-950/40">
                <Shield className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{categories.length}</p>
                <p className="text-xs text-muted-foreground">Action categories</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="flex flex-wrap gap-3 py-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search action, user, IP address…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs shrink-0">Category</Label>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            {(search || categoryFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setCategoryFilter("") }}>
                Clear filters
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Log list */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Activity entries
              {filtered.length !== logs.length && (
                <span className="ml-2 text-sm font-normal text-muted-foreground">({filtered.length} matching)</span>
              )}
            </CardTitle>
            <CardDescription>
              Page {page + 1} · {PAGE_SIZE} per page · most recent first
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filtered.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">No matching log entries found.</p>
            ) : (
              filtered.map((log) => {
                const Icon = actionIcon(log.action)
                const ua = parseUA(log.userAgent)
                const displayCategory = categoryLabel(log.category)
                return (
                  <button
                    key={log.id}
                    onClick={() => setSelected(log)}
                    className="w-full text-left rounded-xl border border-border bg-background p-4 hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${categoryClass(displayCategory)}`}>
                            {displayCategory}
                          </span>
                          {log.entityType && (
                            <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
                              {log.entityType}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <time className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                        {formatDate(log.timestamp)}
                      </time>
                    </div>

                    <p className="mt-2.5 text-sm font-semibold text-foreground leading-snug">{log.action}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <UsersIcon className="h-3 w-3 shrink-0" />
                        <span className="font-medium text-foreground">{log.actorName ?? log.userId}</span>
                      </span>
                      {log.ipAddress && (
                        <span className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                          <Globe2 className="h-3 w-3 shrink-0" />
                          {log.ipAddress}
                        </span>
                      )}
                      {ua && (
                        <span className="text-xs text-muted-foreground truncate max-w-[260px]">{ua}</span>
                      )}
                    </div>
                  </button>
                )
              })
            )}

            {/* Pagination */}
            {!isLoading && (
              <div className="flex items-center justify-between border-t border-border pt-4 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                  className="gap-2"
                >
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <span className="text-xs text-muted-foreground">Page {page + 1}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={logs.length < PAGE_SIZE}
                  onClick={() => setPage((p) => p + 1)}
                  className="gap-2"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Detail dialog */}
      {selected && (
        <Dialog open onOpenChange={() => setSelected(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${categoryClass(categoryLabel(selected.category))}`}>
                  {categoryLabel(selected.category)}
                </span>
                {selected.entityType && (
                  <Badge variant="outline" className="text-[10px] uppercase">{selected.entityType}</Badge>
                )}
              </DialogTitle>
              <DialogDescription asChild>
                <p className="mt-1 text-sm font-semibold text-foreground">{selected.action}</p>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 text-sm">
              {/* Who */}
              <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Performed by</p>
                <p className="font-medium text-foreground">{selected.actorName ?? selected.userId}</p>
                <p className="text-xs text-muted-foreground font-mono">{selected.userId}</p>
              </div>

              {/* When & Where */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Timestamp</p>
                  <p className="text-xs font-mono text-foreground">{formatDate(selected.timestamp)}</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">IP Address</p>
                  <p className="text-xs font-mono text-foreground">{selected.ipAddress ?? "Not captured"}</p>
                </div>
              </div>

              {/* Resource */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Resource type</p>
                  <p className="text-xs font-mono text-foreground">{selected.entityType || "Not captured"}</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Resource ID</p>
                  <p className="text-xs font-mono text-foreground">{selected.entityId ?? "Not captured"}</p>
                </div>
              </div>

              {/* Device */}
              <div className="rounded-lg bg-muted/50 px-4 py-3 space-y-1">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Device / Browser</p>
                <p className="text-xs text-foreground break-words">
                  {selected.userAgent ? (parseUA(selected.userAgent) ?? selected.userAgent) : "—"}
                </p>
              </div>

              {/* Before / After */}
              {(selected.beforeData || selected.afterData) && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">What changed</p>
                  <div className="grid grid-cols-2 gap-3">
                    {selected.beforeData && (
                      <div className="rounded-lg border border-border bg-background px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1.5">Before</p>
                        <pre className="text-[10px] text-foreground whitespace-pre-wrap break-words font-mono leading-relaxed">
                          {JSON.stringify(selected.beforeData, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selected.afterData && (
                      <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2">
                        <p className="text-[10px] font-semibold uppercase text-primary mb-1.5">After</p>
                        <pre className="text-[10px] text-foreground whitespace-pre-wrap break-words font-mono leading-relaxed">
                          {JSON.stringify(selected.afterData, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Log ID */}
              <div className="rounded-lg bg-muted/30 px-4 py-2">
                <p className="text-[10px] font-mono text-muted-foreground">Log ID: {selected.id}</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setSelected(null)}>Close</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
