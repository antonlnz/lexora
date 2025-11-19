"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const passwordRequirements = {
    minLength: password.length >= 8,
    hasUpperCase: /[A-Z]/.test(password),
    hasLowerCase: /[a-z]/.test(password),
    hasNumber: /[0-9]/.test(password),
  }

  const isPasswordValid = Object.values(passwordRequirements).every(Boolean)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (!isPasswordValid) {
      setError("Password does not meet all requirements")
      return
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      setSuccess(true)
      setTimeout(() => {
        router.push("/login")
      }, 2000)
    } catch (err: any) {
      setError(err.message || "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="glass-card p-8 rounded-2xl">
            <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-2xl font-semibold mb-2">Password Updated!</h2>
            <p className="text-muted-foreground mb-6">
              Your password has been successfully updated. Redirecting to login...
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-20 right-20 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />
      </div>

      <div className="w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <h1 className="font-serif text-5xl font-bold mb-2 text-balance">Lexora</h1>
          <p className="text-muted-foreground text-balance">Create a new password</p>
        </div>

        {/* Reset password form */}
        <div className="glass-card p-8 rounded-2xl hover-lift">
          <h2 className="text-2xl font-semibold mb-2 text-center">Set New Password</h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Please enter your new password below.
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="password">New Password</Label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 rounded-lg glass border border-glass-border focus:outline-none focus:ring-2 focus:ring-ring hover-lift-subtle transition-all pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>

              {/* Password requirements */}
              {password && (
                <div className="mt-3 space-y-2 text-sm">
                  <div className={`flex items-center gap-2 ${passwordRequirements.minLength ? "text-green-500" : "text-muted-foreground"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${passwordRequirements.minLength ? "bg-green-500" : "bg-muted-foreground"}`} />
                    At least 8 characters
                  </div>
                  <div className={`flex items-center gap-2 ${passwordRequirements.hasUpperCase ? "text-green-500" : "text-muted-foreground"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${passwordRequirements.hasUpperCase ? "bg-green-500" : "bg-muted-foreground"}`} />
                    One uppercase letter
                  </div>
                  <div className={`flex items-center gap-2 ${passwordRequirements.hasLowerCase ? "text-green-500" : "text-muted-foreground"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${passwordRequirements.hasLowerCase ? "bg-green-500" : "bg-muted-foreground"}`} />
                    One lowercase letter
                  </div>
                  <div className={`flex items-center gap-2 ${passwordRequirements.hasNumber ? "text-green-500" : "text-muted-foreground"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${passwordRequirements.hasNumber ? "bg-green-500" : "bg-muted-foreground"}`} />
                    One number
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-lg glass border border-glass-border focus:outline-none focus:ring-2 focus:ring-ring hover-lift-subtle transition-all"
              />
            </div>

            {error && <p className="text-sm text-destructive text-center">{error}</p>}

            <Button type="submit" className="w-full hover-lift-subtle" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Updating password...
                </>
              ) : (
                "Update Password"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
