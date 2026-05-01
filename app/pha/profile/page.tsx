"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { User, Mail, Shield, Building2, Calendar, Key, CheckCircle2 } from "lucide-react"

import { PHASidebar } from "@/components/pha/pha-sidebar"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getProfile } from "@/lib/api/auth"
import { toast } from "sonner"

export default function PHAProfilePage() {
  const router = useRouter()
  const [profile, setProfile] = useState({
    name: "",
    email: "",
    role: "Public Health Authority",
    region: "National",
    joinedDate: "",
    userId: "",
  })
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
    confirm: "",
  })
  const [isSaving, setIsSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    const legacyToken = localStorage.getItem("authToken")
    const accessToken = localStorage.getItem("accessToken")
    const userId = localStorage.getItem("userId")
    const role = localStorage.getItem("userRole")
    const detail = localStorage.getItem("userRoleDetail")

    const hasAuth = Boolean(userId || accessToken || legacyToken)
    if (!hasAuth || role !== "staff" || detail !== "pha") {
      router.replace("/auth/login")
      return
    }

    let isMounted = true

    // Read whatever the login stored
    const rawProfile = localStorage.getItem("userProfile")
    let parsed: Record<string, string> = {}
    try { parsed = rawProfile ? JSON.parse(rawProfile) : {} } catch { /* ignore */ }

    const cachedName = sessionStorage.getItem("userName") || localStorage.getItem("userName") || "PHA Officer"

    setProfile({
      name:       parsed.fullName  || parsed.full_name  || parsed.name  || cachedName,
      email:      parsed.email     || "",
      role:       "Public Health Authority",
      region:     parsed.region    || "National",
      joinedDate: parsed.createdAt || parsed.created_at || "",
      userId:     userId           || "",
    })

    const loadLiveProfile = async () => {
      try {
        const live = await getProfile()
        if (!isMounted) return

        setProfile((prev) => ({
          ...prev,
          name: live.fullName || prev.name,
          email: live.email || prev.email,
          joinedDate: live.createdAt || prev.joinedDate,
          userId: live.id || prev.userId,
        }))
      } catch {
        // Keep cached fallback values if live fetch fails.
      }
    }

    loadLiveProfile()

    return () => {
      isMounted = false
    }
  }, [router])

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passwordForm.next || passwordForm.next !== passwordForm.confirm) {
      toast.error("New passwords do not match")
      return
    }
    if (passwordForm.next.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setIsSaving(true)
    try {
      const token = localStorage.getItem("accessToken") || localStorage.getItem("authToken")
      const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api"
      const res = await fetch(`${apiBase}/auth/change-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentPassword: passwordForm.current,
          newPassword: passwordForm.next,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.message || "Password change failed")
      }
      setSaved(true)
      setPasswordForm({ current: "", next: "", confirm: "" })
      toast.success("Password updated successfully")
      setTimeout(() => setSaved(false), 3000)
    } catch (err: any) {
      toast.error(err.message ?? "Failed to update password")
    } finally {
      setIsSaving(false)
    }
  }

  const formatDate = (iso: string) => {
    if (!iso) return "—"
    try {
      return new Date(iso).toLocaleDateString("en-GH", {
        day: "numeric", month: "long", year: "numeric",
      })
    } catch { return "—" }
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden">
      <PHASidebar />

      <div className="flex-1 overflow-y-auto bg-muted/20">
        <main className="space-y-6 px-4 py-5 sm:px-6 sm:py-8">

          {/* Page header */}
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">My Profile</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">Account details and security settings</p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Profile info card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" /> Account Information
                </CardTitle>
                <CardDescription>Your identity in the CVCC system</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl font-bold text-primary">
                    {profile.name ? profile.name[0].toUpperCase() : "P"}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{profile.name}</p>
                    <Badge variant="outline" className="mt-1 border-primary/40 bg-primary/5 text-primary text-xs">
                      <Shield className="mr-1 h-3 w-3" /> PHA Officer
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border bg-muted/20 p-4 text-sm">
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">Email</span>
                    <span className="ml-auto font-medium text-foreground">{profile.email || "—"}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Shield className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">Role</span>
                    <span className="ml-auto font-medium text-foreground">{profile.role}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">Scope</span>
                    <span className="ml-auto font-medium text-foreground">{profile.region}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="text-muted-foreground">Account Created</span>
                    <span className="ml-auto font-medium text-foreground">{formatDate(profile.joinedDate)}</span>
                  </div>
                </div>

                {/* Access level notice */}
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                  <p className="text-xs font-semibold text-primary">Read-Only Access Level</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    As a PHA Officer you have read-only access to all national dashboards, reports, and certificate verification. Data modification requires Facility Nurse or HQ Admin credentials.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Change password card */}
            <Card className="self-start">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Key className="h-5 w-5 text-primary" /> Change Password
                </CardTitle>
                <CardDescription>Update your login credentials</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordChange} className="space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="current-pw">Current Password</Label>
                    <Input
                      id="current-pw"
                      type="password"
                      placeholder="Enter current password"
                      value={passwordForm.current}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, current: e.target.value }))}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="new-pw">New Password</Label>
                    <Input
                      id="new-pw"
                      type="password"
                      placeholder="At least 8 characters"
                      value={passwordForm.next}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, next: e.target.value }))}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-pw">Confirm New Password</Label>
                    <Input
                      id="confirm-pw"
                      type="password"
                      placeholder="Repeat new password"
                      value={passwordForm.confirm}
                      onChange={(e) => setPasswordForm((p) => ({ ...p, confirm: e.target.value }))}
                      disabled={isSaving}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full gap-2"
                    disabled={isSaving || !passwordForm.current || !passwordForm.next || !passwordForm.confirm}
                  >
                    {saved ? (
                      <><CheckCircle2 className="h-4 w-4" /> Password Updated</>
                    ) : isSaving ? (
                      "Saving…"
                    ) : (
                      <><Key className="h-4 w-4" /> Update Password</>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>

        </main>
      </div>
    </div>
  )
}
