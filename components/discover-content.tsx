"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GlassStatsCard } from "@/components/glass-components"
import { Search, TrendingUp, Users, Zap, Plus, ExternalLink, Star, File as Fire } from "lucide-react"

const trendingTopics = [
  { name: "AI & Machine Learning", count: 1247, growth: "+23%" },
  { name: "Sustainable Technology", count: 892, growth: "+18%" },
  { name: "Web Development", count: 2156, growth: "+12%" },
  { name: "Design Systems", count: 634, growth: "+31%" },
  { name: "Productivity", count: 1089, growth: "+15%" },
  { name: "Startup Culture", count: 756, growth: "+8%" },
]

const recommendedSources = [
  {
    name: "MIT Technology Review",
    type: "News",
    description: "In-depth analysis of emerging technologies and their impact on business and society.",
    subscribers: "2.1M",
    rating: 4.8,
    tags: ["Technology", "Research", "Innovation"],
    image: "/placeholder.svg?height=100&width=100",
  },
  {
    name: "Casey Neistat",
    type: "YouTube",
    description: "Creative storytelling, filmmaking tips, and entrepreneurial insights.",
    subscribers: "12.4M",
    rating: 4.9,
    tags: ["Creativity", "Filmmaking", "Entrepreneurship"],
    image: "/placeholder.svg?height=100&width=100",
  },
  {
    name: "Julie Zhuo",
    type: "Newsletter",
    description: "Weekly insights on product design, leadership, and building great teams.",
    subscribers: "45K",
    rating: 4.7,
    tags: ["Design", "Leadership", "Product"],
    image: "/placeholder.svg?height=100&width=100",
  },
  {
    name: "Stripe",
    type: "Twitter",
    description: "Updates on internet infrastructure, payments, and developer tools.",
    subscribers: "890K",
    rating: 4.6,
    tags: ["Fintech", "Development", "Business"],
    image: "/placeholder.svg?height=100&width=100",
  },
]

const curatedCollections = [
  {
    name: "Design Excellence",
    description: "The best design resources, inspiration, and thought leadership",
    sources: 24,
    subscribers: "12.5K",
    image: "/placeholder.svg?height=150&width=200",
    tags: ["Design", "UI/UX", "Inspiration"],
  },
  {
    name: "Tech Leadership",
    description: "Insights from CTOs, engineering managers, and tech executives",
    sources: 18,
    subscribers: "8.9K",
    image: "/placeholder.svg?height=150&width=200",
    tags: ["Leadership", "Technology", "Management"],
  },
  {
    name: "Startup Ecosystem",
    description: "Everything about building, funding, and scaling startups",
    sources: 31,
    subscribers: "15.2K",
    image: "/placeholder.svg?height=150&width=200",
    tags: ["Startups", "Venture Capital", "Entrepreneurship"],
  },
]

export function DiscoverContent() {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="space-y-8 pb-24 md:pb-0">
      {/* Search */}
      <div className="relative max-w-2xl mx-auto hover-lift-subtle">
        <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder="Search for sources, topics, or creators..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 h-12 glass text-lg"
        />
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassStatsCard title="Trending Topics" value="127" change="+12%" trend="up" icon={TrendingUp} />
        <GlassStatsCard title="New Sources" value="43" change="+8%" trend="up" icon={Plus} />
        <GlassStatsCard title="Active Users" value="2.1M" change="+15%" trend="up" icon={Users} />
      </div>

      <Tabs defaultValue="trending" className="w-full">
        <TabsList className="glass-card mb-8">
          <TabsTrigger value="trending" className="hover-lift-subtle">
            <Fire className="h-4 w-4 mr-2" />
            Trending
          </TabsTrigger>
          <TabsTrigger value="recommended" className="hover-lift-subtle">
            <Star className="h-4 w-4 mr-2" />
            Recommended
          </TabsTrigger>
          <TabsTrigger value="collections" className="hover-lift-subtle">
            <Zap className="h-4 w-4 mr-2" />
            Collections
          </TabsTrigger>
        </TabsList>

        <TabsContent value="trending" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Trending Topics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {trendingTopics.map((topic) => (
                <Card key={topic.name} className="glass-card p-4 hover:shadow-xl hover-lift-subtle transition-all cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold">{topic.name}</h3>
                    <Badge variant="secondary" className="glass">
                      {topic.growth}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{topic.count.toLocaleString()} articles</p>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="recommended" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Recommended for You</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {recommendedSources.map((source) => (
                <Card key={source.name} className="glass-card p-6 hover:shadow-lg transition-all">
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 rounded-xl glass overflow-hidden shrink-0">
                      <img
                        src={source.image || "/placeholder.svg"}
                        alt={source.name}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{source.name}</h3>
                        <Badge variant="outline" className="glass">
                          {source.type}
                        </Badge>
                      </div>

                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{source.description}</p>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          {source.subscribers}
                        </span>
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 fill-current text-yellow-500" />
                          {source.rating}
                        </span>
                      </div>

                      <div className="flex flex-wrap gap-1 mb-4">
                        {source.tags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-xs glass">
                            {tag}
                          </Badge>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button size="sm" className="default flex-1">
                          <Plus className="h-4 w-4 mr-2" />
                          Follow
                        </Button>
                        <Button variant="ghost" size="sm" className="glass">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="collections" className="space-y-6">
          <div>
            <h2 className="text-2xl font-semibold mb-4">Curated Collections</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {curatedCollections.map((collection) => (
                <Card key={collection.name} className="glass-card overflow-hidden hover:shadow-xl transition-all group">
                  <div className="aspect-video relative overflow-hidden">
                    <img
                      src={collection.image || "/placeholder.svg"}
                      alt={collection.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 left-4 text-white">
                      <h3 className="font-semibold text-lg mb-1">{collection.name}</h3>
                      <p className="text-sm opacity-90">{collection.sources} sources</p>
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{collection.description}</p>

                    <div className="flex flex-wrap gap-1 mb-4">
                      {collection.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs glass">
                          {tag}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{collection.subscribers} subscribers</span>
                      <Button size="sm" className="default">
                        <Plus className="h-4 w-4 mr-2" />
                        Subscribe
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
