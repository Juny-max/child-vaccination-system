"use client"

import Link from "next/link"

import { WifiOff } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-10 text-foreground">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <WifiOff className="h-6 w-6 text-muted-foreground" />
          </div>
          <CardTitle>You are offline</CardTitle>
          <CardDescription>
            The app shell is available, but this page is not cached yet. Reconnect and try again.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button onClick={() => window.location.reload()}>Retry</Button>
          <Button asChild variant="outline">
            <Link href="/chw/dashboard">Open CHW Dashboard</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/">Go to Home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
