"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Bookmark, BookmarkCheck, Clock, ExternalLink, Play, Share, User } from "lucide-react"
import Image from "next/image"

interface ContentItem {
  id: string
  type: "news" | "youtube" | "twitter" | "instagram" | "tiktok" | "newsletter"
  title: string
  excerpt: string
  source: string
  author: string
  publishedAt: string
  readTime?: string
  duration?: string
  image: string
  tags: string[]
  isRead: boolean
  isSaved: boolean
  views?: string
  engagement?: string
}

interface ContentCardProps {
  content: ContentItem
  viewMode: "grid" | "list"
  onOpenViewer?: (content: ContentItem, cardElement: HTMLElement) => void
}

const typeIcons = {
  news: "📰",
  youtube: "🎥",
  twitter: "🐦",
  instagram: "📸",
  tiktok: "🎵",
  newsletter: "📧",
}

const typeColors = {
  news: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  youtube: "bg-red-500/10 text-red-600 border-red-500/20",
  twitter: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  instagram: "bg-pink-500/10 text-pink-600 border-pink-500/20",
  tiktok: "bg-purple-500/10 text-purple-600 border-purple-500/20",
  newsletter: "bg-green-500/10 text-green-600 border-green-500/20",
}

export function ContentCard({ content, viewMode, onOpenViewer }: ContentCardProps) {
  const [isSaved, setIsSaved] = useState(content.isSaved)
  const [isRead, setIsRead] = useState(content.isRead)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleSave = () => {
    setIsSaved(!isSaved)
  }

  const handleMarkRead = () => {
    setIsRead(!isRead)
  }

  const handleOpenContent = () => {
    if (onOpenViewer && cardRef.current) {
      onOpenViewer(content, cardRef.current)
    }
  }

  const handleOpenInNewTab = (e: React.MouseEvent) => {
    e.stopPropagation()
    window.open(`/read/${content.id}`, "_blank")
  }

  if (viewMode === "list") {
    return (
      <Card
        ref={cardRef}
        className={`glass-card p-4 hover-lift-subtle transition-all duration-300 cursor-pointer ${isRead ? "opacity-60" : ""}`}
        onClick={handleOpenContent}
      >
        <div className="flex gap-4">
          <div className="relative w-24 h-24 flex-shrink-0 rounded-lg overflow-hidden">
            <Image src={content.image || "/placeholder.svg"} alt={content.title} fill className="object-cover" />
            {content.duration && (
              <div className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1 rounded">
                {content.duration}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={typeColors[content.type]}>
                  {typeIcons[content.type]} {content.type}
                </Badge>
                <span className="text-sm text-muted-foreground">{content.source}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={handleSave} className="h-8 w-8 p-0">
                  {isSaved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-pretty">{content.title}</h3>
            <p className="text-muted-foreground text-sm mb-3 line-clamp-2">{content.excerpt}</p>

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {content.author}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {content.publishedAt}
                </span>
                {content.readTime && <span>{content.readTime}</span>}
                {content.views && <span>{content.views}</span>}
                {content.engagement && <span>{content.engagement}</span>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMarkRead()
                }}
                className="text-xs"
              >
                {isRead ? "Mark Unread" : "Mark Read"}
              </Button>
            </div>

            <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  handleMarkRead()
                }}
                className="text-xs"
              >
                {isRead ? "Mark Unread" : "Mark Read"}
              </Button>
              <Button size="sm" className="glass" onClick={handleOpenInNewTab}>
                <ExternalLink className="h-3 w-3 mr-2" />
                Read
              </Button>
            </div>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card
      ref={cardRef}
      className={`glass-card overflow-hidden hover-lift-strong transition-all duration-300 group cursor-pointer ${isRead ? "opacity-60" : ""}`}
      onClick={handleOpenContent}
    >
      <div className="relative aspect-video overflow-hidden">
        <Image
          src={content.image || "/placeholder.svg"}
          alt={content.title}
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
        />
        {content.duration && (
          <div className="absolute bottom-2 right-2 bg-black/80 text-white text-sm px-2 py-1 rounded">
            {content.duration}
          </div>
        )}
        {content.type === "youtube" || content.type === "tiktok" ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-black/50 rounded-full p-3 group-hover:bg-black/70 transition-colors">
              <Play className="h-6 w-6 text-white fill-white" />
            </div>
          </div>
        ) : null}
        <div className="absolute top-2 left-2">
          <Badge variant="outline" className={`${typeColors[content.type]} backdrop-blur-sm`}>
            {typeIcons[content.type]} {content.type}
          </Badge>
        </div>
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <span className="text-sm text-muted-foreground font-medium">{content.source}</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleSave} className="h-8 w-8 p-0">
              {isSaved ? <BookmarkCheck className="h-4 w-4 text-primary" /> : <Bookmark className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <Share className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <h3 className="font-semibold text-lg mb-2 line-clamp-2 text-pretty">{content.title}</h3>
        <p className="text-muted-foreground text-sm mb-4 line-clamp-3">{content.excerpt}</p>

        <div className="flex flex-wrap gap-1 mb-4">
          {content.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs glass">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {content.author}
            </span>
            <span>•</span>
            <span>{content.publishedAt}</span>
          </div>
          <div className="flex items-center gap-2">
            {content.readTime && <span>{content.readTime}</span>}
            {content.views && <span>{content.views}</span>}
            {content.engagement && <span className="text-xs">{content.engagement}</span>}
          </div>
        </div>

        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border/50">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              handleMarkRead()
            }}
            className="text-xs"
          >
            {isRead ? "Mark Unread" : "Mark Read"}
          </Button>
          <Button size="sm" className="default" onClick={handleOpenInNewTab}>
            <ExternalLink className="h-3 w-3 mr-2" />
            Read
          </Button>
        </div>
      </div>
    </Card>
  )
}
