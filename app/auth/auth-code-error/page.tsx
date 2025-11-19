"use client"

import { AlertCircle } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AuthCodeError() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center">
        <div className="glass-card p-8 rounded-2xl">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-2xl font-semibold mb-2">Authentication Error</h2>
          <p className="text-muted-foreground mb-6">
            There was an error verifying your email. The link may have expired or is invalid.
          </p>
          <div className="space-y-3">
            <Link href="/signup" className="block">
              <Button className="w-full" variant="default">
                Try signing up again
              </Button>
            </Link>
            <Link href="/login" className="block">
              <Button className="w-full" variant="outline">
                Go to login
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
