"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GlassStatsCard, GlassProgressCard, GlassActivityFeed } from "@/components/glass-components"
import { Search, Bookmark, Clock, Archive, BarChart3, Download, Filter } from "lucide-react"

export function ArchiveContent() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <GlassStatsCard title="Total Read" value="1,247" change="+23 this week" trend="up" icon={Clock} />
        <GlassStatsCard title="Saved Items" value="89" change="+5 this week" trend="up" icon={Bookmark} />
        <GlassStatsCard title="Reading Time" value="42h" change="+3h this week" trend="up" icon={BarChart3} />
        <GlassStatsCard title="Archived" value="2,156" change="+12 this week" trend="up" icon={Archive} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search your archive..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 glass"
              />
            </div>
            <Button variant="outline" className="glass bg-transparent">
              <Filter className="h-4 w-4 mr-2" />
              Filters
            </Button>
            <Button variant="outline" className="glass bg-transparent">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>

          <Tabs defaultValue="saved" className="w-full">
            <TabsList className="glass-card justify-start mb-6">
              <TabsTrigger value="saved" className="hover-lift-subtle">
                <Bookmark className="h-4 w-4 mr-2" />
                Saved
              </TabsTrigger>
              <TabsTrigger value="read" className="hover-lift-subtle">
                <Clock className="h-4 w-4 mr-2" />
                Read
              </TabsTrigger>
              <TabsTrigger value="archived" className="hover-lift-subtle">
                <Archive className="h-4 w-4 mr-2" />
                Archived
              </TabsTrigger>
            </TabsList>

            <TabsContent value="saved" className="space-y-4 mt-6">
              {/* Saved items would go here */}
              <Card className="glass-card p-6 text-center">
                <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">No saved items yet</h3>
                <p className="text-muted-foreground">Items you save will appear here for easy access later.</p>
              </Card>
            </TabsContent>

            <TabsContent value="read" className="space-y-4 mt-6">
              <Card className="glass-card p-6 text-center">
                <Clock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Reading history</h3>
                <p className="text-muted-foreground">Your reading history will be displayed here.</p>
              </Card>
            </TabsContent>

            <TabsContent value="archived" className="space-y-4 mt-6">
              <Card className="glass-card p-6 text-center">
                <Archive className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">Archived content</h3>
                <p className="text-muted-foreground">Content you've archived will be stored here.</p>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          {/* Reading Progress */}
          <GlassProgressCard
            title="Weekly Reading Goal"
            description="Keep up the great work!"
            progress={24}
            total={30}
          />

          {/* Activity Feed */}
          <GlassActivityFeed />

          {/* Reading Stats */}
          <Card className="glass-card p-6">
            <h3 className="text-lg font-semibold mb-4">This Month</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Articles read</span>
                <span className="font-semibold">127</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Time spent</span>
                <span className="font-semibold">18h 42m</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Favorite topic</span>
                <Badge variant="secondary" className="glass">
                  Technology
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Streak</span>
                <span className="font-semibold">12 days</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
