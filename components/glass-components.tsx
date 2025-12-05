"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, Bookmark, Eye, Share2, Heart, Zap } from "lucide-react"

interface GlassStatsCardProps {
  title: string
  value: string | number
  change?: string
  trend?: "up" | "down" | "neutral"
  icon: React.ComponentType<{ className?: string }>
}

export function GlassStatsCard({ title, value, change, trend, icon: Icon }: GlassStatsCardProps) {
  return (
    <Card className="glass-card p-6 hover-lift transition-all duration-300 group">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground mb-1">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {change && (
            <div className="flex items-center mt-2">
              <TrendingUp
                className={`h-4 w-4 mr-1 ${
                  trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"
                }`}
              />
              <span
                className={`text-sm ${
                  trend === "up" ? "text-green-600" : trend === "down" ? "text-red-600" : "text-muted-foreground"
                }`}
              >
                {change}
              </span>
            </div>
          )}
        </div>
        <div className="glass p-3 rounded-xl group-hover:scale-110 transition-transform">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </Card>
  )
}

interface GlassProgressCardProps {
  title: string
  description: string
  progress: number
  total: number
  color?: string
}

export function GlassProgressCard({ title, description, progress, total, color = "primary" }: GlassProgressCardProps) {
  const percentage = (progress / total) * 100

  return (
    <Card className="glass-card p-6 hover-lift transition-all duration-300">
      <div className="space-y-4">
        <div>
          <h3 className="font-semibold text-lg">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>{progress} completed</span>
            <span>{total} total</span>
          </div>
          <Progress value={percentage} className="h-2" />
          <div className="text-right">
            <Badge variant="secondary" className="glass">
              {Math.round(percentage)}%
            </Badge>
          </div>
        </div>
      </div>
    </Card>
  )
}

interface GlassActivityItemProps {
  type: "read" | "saved" | "shared" | "liked"
  title: string
  source: string
  time: string
}

const activityIcons = {
  read: Eye,
  saved: Bookmark,
  shared: Share2,
  liked: Heart,
}

const activityColors = {
  read: "text-blue-600",
  saved: "text-green-600",
  shared: "text-purple-600",
  liked: "text-red-600",
}

export function GlassActivityItem({ type, title, source, time }: GlassActivityItemProps) {
  const Icon = activityIcons[type]

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg glass hover:bg-accent/30 hover-lift-subtle transition-all duration-200 cursor-pointer">
      <div className={`glass p-2 rounded-lg ${activityColors[type]}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm line-clamp-1">{title}</p>
        <p className="text-xs text-muted-foreground">
          {source} • {time}
        </p>
      </div>
    </div>
  )
}

export function GlassActivityFeed() {
  const activities = [
    { type: "read" as const, title: "The Future of Sustainable Technology", source: "TechCrunch", time: "2m ago" },
    { type: "saved" as const, title: "Building Modern Web Applications", source: "Vercel", time: "5m ago" },
    { type: "shared" as const, title: "Psychology behind great design", source: "Twitter", time: "12m ago" },
    { type: "liked" as const, title: "Weekly Design Inspiration", source: "Newsletter", time: "1h ago" },
    { type: "read" as const, title: "Behind the scenes photoshoot", source: "Instagram", time: "2h ago" },
  ]

  return (
    <Card className="glass-card p-6 hover-lift">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent Activity</h3>
        <Badge variant="secondary" className="glass">
          <Zap className="h-3 w-3 mr-1" />
          Live
        </Badge>
      </div>
      <div className="space-y-2">
        {activities.map((activity, index) => (
          <GlassActivityItem key={index} {...activity} />
        ))}
      </div>
    </Card>
  )
}

interface GlassFloatingActionButtonProps {
  onClick: () => void
  icon: React.ComponentType<{ className?: string }>
  label: string
}

export function GlassFloatingActionButton({ onClick, icon: Icon, label }: GlassFloatingActionButtonProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const toggleVisibility = () => {
      if (window.pageYOffset > 300) {
        setIsVisible(true)
      } else {
        setIsVisible(false)
      }
    }

    window.addEventListener("scroll", toggleVisibility)
    return () => window.removeEventListener("scroll", toggleVisibility)
  }, [])

  if (!isVisible) return null

  return (
    <Button
      onClick={onClick}
      className="fixed right-6 h-14 w-14 rounded-full glass-card shadow-xl hover-lift-strong z-50"
      style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))' }}
      size="sm"
    >
      <Icon className="h-6 w-6" />
      <span className="sr-only">{label}</span>
    </Button>
  )
}

export function GlassNotificationBadge({ count }: { count: number }) {
  if (count === 0) return null

  return (
    <div className="absolute -top-2 -right-2 h-5 w-5 glass-card rounded-full flex items-center justify-center hover-lift-subtle">
      <span className="text-xs font-bold text-primary">{count > 99 ? "99+" : count}</span>
    </div>
  )
}

interface GlassTooltipProps {
  content: string
  children: React.ReactNode
}

export function GlassTooltip({ content, children }: GlassTooltipProps) {
  const [isVisible, setIsVisible] = useState(false)

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      {isVisible && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 glass-card rounded-lg text-sm whitespace-nowrap z-50 hover-lift-subtle">
          {content}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-glass-border"></div>
        </div>
      )}
    </div>
  )
}
