"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { DotLottieReact } from "@lottiefiles/dotlottie-react"
import { Home, ArrowLeft, Search, HelpCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

export default function NotFound() {
  const router = useRouter()

  return (
    <div className="h-screen overflow-hidden flex items-center justify-center p-4 bg-gradient-to-b from-background to-muted/20">
      <Card className="max-w-2xl w-full max-h-[95vh] overflow-y-auto p-6 md:p-8 shadow-lg">
        <div className="flex flex-col items-center text-center space-y-4">
          {/* Lottie Animation */}
          <div className="w-full max-w-sm h-48 md:h-56">
            <DotLottieReact 
              src="/error%20404%20outdoor.lottie" 
              autoplay 
              loop 
              className="h-full w-full" 
            />
          </div>

          {/* Error Message */}
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground">
              404 - Page Not Found
            </h1>
            <p className="text-base md:text-lg text-muted-foreground max-w-md">
              Oops! The page you're looking for seems to have wandered off. 
              It might have been moved, deleted, or never existed.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto pt-2">
            <Button asChild size="lg" className="gap-2">
              <Link href="/">
                <Home className="h-4 w-4" />
                Go to Homepage
              </Link>
            </Button>
            
            <Button 
              variant="outline" 
              size="lg" 
              className="gap-2"
              onClick={() => router.back()}
            >
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>

          {/* Quick Links */}
          <div className="pt-4 border-t w-full">
            <p className="text-xs md:text-sm text-muted-foreground mb-3 flex items-center justify-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Need help? Try these:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Link 
                href="/auth/login" 
                className="flex items-center justify-center gap-2 p-2 rounded-lg border hover:bg-accent transition-colors"
              >
                <Search className="h-4 w-4" />
                <span className="text-xs md:text-sm font-medium">Staff Login</span>
              </Link>
              <Link 
                href="/auth/parent-login" 
                className="flex items-center justify-center gap-2 p-2 rounded-lg border hover:bg-accent transition-colors"
              >
                <Search className="h-4 w-4" />
                <span className="text-xs md:text-sm font-medium">Parent Login</span>
              </Link>
              <Link 
                href="/discover" 
                className="flex items-center justify-center gap-2 p-2 rounded-lg border hover:bg-accent transition-colors"
              >
                <Search className="h-4 w-4" />
                <span className="text-xs md:text-sm font-medium">Discover</span>
              </Link>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
