import { useState, useCallback, useEffect } from 'react'
import { useToast } from '@/hooks/use-toast'

export interface ContentItem {
  id: string
  sourceId: string
  userId: string
  title: string
  description: string | null
  content: string | null
  textContent: string | null
  url: string
  author: string | null
  publishedAt: Date | null
  thumbnail: string | null
  mediaUrl: string | null
  mediaType: string | null
  isRead: boolean
  isStarred: boolean
  isArchived: boolean
  createdAt: Date
  updatedAt: Date
}

export function useSources(userId: string) {
  const [items, setItems] = useState<ContentItem[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const fetchContent = useCallback(async (filters?: {
    isRead?: boolean
    isStarred?: boolean
    isArchived?: boolean
  }) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ userId })
      
      if (filters?.isRead !== undefined) {
        params.append('isRead', String(filters.isRead))
      }
      if (filters?.isStarred !== undefined) {
        params.append('isStarred', String(filters.isStarred))
      }
      if (filters?.isArchived !== undefined) {
        params.append('isArchived', String(filters.isArchived))
      }

      const response = await fetch(`/api/content?${params}`)
      if (!response.ok) throw new Error('Error al cargar contenido')
      
      const data = await response.json()
      setItems(data)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el contenido',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [userId, toast])

  const markAsRead = useCallback(async (itemId: string, isRead: boolean) => {
    try {
      const response = await fetch(`/api/content/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isRead }),
      })

      if (!response.ok) throw new Error('Error al actualizar')

      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, isRead } : item
      ))
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el artículo',
        variant: 'destructive',
      })
    }
  }, [toast])

  const toggleStar = useCallback(async (itemId: string) => {
    try {
      const item = items.find(i => i.id === itemId)
      if (!item) return

      const response = await fetch(`/api/content/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isStarred: !item.isStarred }),
      })

      if (!response.ok) throw new Error('Error al actualizar')

      setItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, isStarred: !i.isStarred } : i
      ))
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el artículo',
        variant: 'destructive',
      })
    }
  }, [items, toast])

  return {
    items,
    loading,
    fetchContent,
    markAsRead,
    toggleStar,
  }
}