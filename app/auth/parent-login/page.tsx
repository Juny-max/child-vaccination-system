"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, Check, Heart } from "lucide-react"

export default function ParentLogin() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)

    if (email && password.length >= 6) {
      localStorage.setItem("authToken", "mock-jwt-token")
      localStorage.setItem("userRole", "parent")
      localStorage.setItem("userName", email.split("@")[0])

      router.push("/parent/dashboard")
    } else {
      setError("Please enter valid credentials")
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/5 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-lg flex items-center justify-center bg-transparent">
              <Image
                src="/CVCC TRANSparent.png"
                alt="CVCC logo"
                width={112}
                height={112}
                className="object-contain bg-transparent"
                style={{ backgroundColor: "transparent" }}
                priority
              />
            </div>
          </div>
          <div className="text-center">
            <CardTitle className="text-2xl">Parent Login</CardTitle>
            <CardDescription>View your child's vaccination records</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="parent@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">Demo Access</span>
            </div>
          </div>

          <div className="space-y-2 text-sm">
            <p className="font-semibold text-foreground">Try this demo account:</p>
            <ul className="space-y-1 text-muted-foreground">
              <li className="flex items-center gap-2">
                <Check size={14} className="text-primary" />
                <span>parent@example.com</span>
              </li>
            </ul>
            <p className="text-xs text-muted-foreground mt-2">Password: any 6+ characters</p>
          </div>

          <div className="pt-4 text-center">
            <p className="text-sm text-muted-foreground">
              Are you a healthcare worker?{" "}
              <Link href="/auth/staff-login" className="text-primary hover:underline">
                Staff Login
              </Link>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
