"use client"

import type React from "react"
import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react"
import Link from "next/link"

export default function SignupPage() {
  const { signup } = useAuth()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)

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
      await signup(email, password, name)
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || "An error occurred during signup")
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
            <h2 className="text-2xl font-semibold mb-2">Check your email</h2>
            <p className="text-muted-foreground mb-6">
              We've sent you a confirmation link to <strong>{email}</strong>. Please check your email to verify your
              account.
            </p>
            <Link href="/login">
              <Button className="w-full">Go to Login</Button>
            </Link>
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
          <p className="text-muted-foreground text-balance">Start your content journey</p>
        </div>

        {/* Signup form */}
        <div className="glass-card p-8 rounded-2xl hover-lift">
          <h2 className="text-2xl font-semibold mb-6 text-center">Create Account</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="John Doe"
                required
                className="w-full px-4 py-3 rounded-lg glass border border-glass-border focus:outline-none focus:ring-2 focus:ring-ring hover-lift-subtle transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 rounded-lg glass border border-glass-border focus:outline-none focus:ring-2 focus:ring-ring hover-lift-subtle transition-all"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
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
              <Label htmlFor="confirmPassword">Confirm Password</Label>
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
                  Creating account...
                </>
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground mt-8">
          By continuing, you agree to Lexora's{" "}
          <Link href="/terms" className="underline hover:text-foreground">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  )
}
