"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { GlassNotificationBadge, GlassTooltip } from "@/components/glass-components"
import { Newspaper, Youtube, Twitter, Instagram, Music2, Mail, Plus, TrendingUp, Clock, Bookmark } from "lucide-react"
import { useState } from "react"
import { AddSourceDialog } from "@/components/add-source-dialog"
import { useSubscription } from "@/contexts/subscription-context"

const initialSources = [
  {
    name: "News",
    icon: Newspaper,
    count: 24,
    color: "bg-blue-500/20 text-blue-600",
    hasNotifications: true,
    notificationCount: 3,
  },
  {
    name: "YouTube",
    icon: Youtube,
    count: 12,
    color: "bg-red-500/20 text-red-600",
    hasNotifications: false,
    notificationCount: 0,
  },
  {
    name: "Twitter",
    icon: Twitter,
    count: 48,
    color: "bg-sky-500/20 text-sky-600",
    hasNotifications: true,
    notificationCount: 5,
  },
  {
    name: "Instagram",
    icon: Instagram,
    count: 8,
    color: "bg-pink-500/20 text-pink-600",
    hasNotifications: false,
    notificationCount: 0,
  },
  {
    name: "TikTok",
    icon: Music2,
    count: 15,
    color: "bg-purple-500/20 text-purple-600",
    hasNotifications: false,
    notificationCount: 2,
  },
  {
    name: "Newsletters",
    icon: Mail,
    count: 6,
    color: "bg-green-500/20 text-green-600",
    hasNotifications: true,
    notificationCount: 0,
  },
]

const quickActions = [
  { name: "Trending", icon: TrendingUp, notifications: 5 },
  { name: "Recent", icon: Clock, notifications: 0 },
  { name: "Saved", icon: Bookmark, notifications: 2 },
]

export function Sidebar() {
  const [isAddSourceOpen, setIsAddSourceOpen] = useState(false)
  const { canAddSource } = useSubscription()
  const [sources, setSources] = useState<any[]>(initialSources)

  const handleAddSource = (newSource: any) => {
    setSources((prev) => [...prev, { ...newSource, id: Date.now().toString() }])
    setIsAddSourceOpen(false)
  }

  return (
    <>
      <div className="space-y-6">
        {/* Quick Actions */}
        <div className="glass-card p-6 rounded-2xl hover-lift">
          <h3 className="text-lg font-semibold mb-4 text-balance">Quick Access</h3>
          <div className="space-y-2">
            {quickActions.map((action) => (
              <div key={action.name} className="relative">
                <GlassTooltip content={`View ${action.name.toLowerCase()} content`}>
                  <Button variant="ghost" className="w-full justify-start glass hover:bg-accent/50 hover-lift-subtle">
                    <action.icon className="h-4 w-4 mr-3" />
                    {action.name}
                  </Button>
                </GlassTooltip>
                {action.notifications > 0 && <GlassNotificationBadge count={action.notifications} />}
              </div>
            ))}
          </div>
        </div>

        {/* Sources */}
        <div className="glass-card p-6 rounded-2xl hover-lift">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-balance">Sources</h3>
            <GlassTooltip content="Add new source">
              <Button
                size="sm"
                variant="ghost"
                className="glass"
                onClick={() => setIsAddSourceOpen(true)}
                disabled={!canAddSource(sources.length)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </GlassTooltip>
          </div>

          <div className="space-y-3">
            {sources.map((source) => (
              <div
                key={source.name}
                className="flex items-center justify-between p-3 rounded-xl glass hover:bg-accent/30 hover-lift-subtle transition-colors cursor-pointer relative"
              >
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${source.color}`}>
                    <source.icon className="h-4 w-4" />
                  </div>
                  <span className="font-medium">{source.name}</span>
                </div>
                <Badge variant="secondary" className="glass">
                  {source.count}
                </Badge>
                {source.hasNotifications && <GlassNotificationBadge count={source.notificationCount} />}
              </div>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="glass-card p-6 rounded-2xl hover-lift">
          <h3 className="text-lg font-semibold mb-4 text-balance">Today's Summary</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">New items</span>
              <span className="font-semibold text-primary">113</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Read</span>
              <span className="font-semibold">24</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Saved</span>
              <span className="font-semibold">8</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Reading time</span>
              <span className="font-semibold">2h 15m</span>
            </div>
          </div>
        </div>
      </div>

      {/* AddSourceDialog component */}
      <AddSourceDialog open={isAddSourceOpen} onOpenChange={setIsAddSourceOpen} onAdd={handleAddSource} />
    </>
  )
}
