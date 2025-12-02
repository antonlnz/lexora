import { createClient } from '@/lib/supabase/client'
import type { 
  ArchiveFolder, 
  ArchiveFolderInsert, 
  ArchiveFolderUpdate,
  ArchiveFolderWithChildren
} from '@/types/database'

// Carpeta con conteo de items
export type FolderWithCount = ArchiveFolder & {
  item_count: number
}

// Estructura de árbol de carpetas
export type FolderTree = ArchiveFolder & {
  children: FolderTree[]
  item_count: number
}

// Colores predefinidos para carpetas
export const FOLDER_COLORS = [
  { name: 'Gray', value: '#6b7280' },
  { name: 'Red', value: '#ef4444' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#22c55e' },
  { name: 'Blue', value: '#3b82f6' },
  { name: 'Purple', value: '#a855f7' },
  { name: 'Pink', value: '#ec4899' },
]

// Iconos predefinidos para carpetas
export const FOLDER_ICONS = [
  'folder', 'star', 'heart', 'bookmark', 'tag', 'archive',
  'book', 'briefcase', 'code', 'coffee', 'film', 'globe',
  'home', 'image', 'link', 'music', 'newspaper', 'video'
]

export class FolderService {
  private getClient() {
    return createClient()
  }

  /**
   * Obtiene todas las carpetas del usuario
   */
  async getUserFolders(): Promise<FolderWithCount[]> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return []

    // Obtener carpetas
    const { data: folders, error } = await supabase
      .from('archive_folders')
      .select('*')
      .eq('user_id', user.id)
      .order('position', { ascending: true })

    if (error) {
      console.error('Error fetching folders:', error)
      return []
    }

    if (!folders || folders.length === 0) return []

    // Obtener conteo de items por carpeta
    const { data: counts } = await supabase
      .from('user_content')
      .select('folder_id')
      .eq('user_id', user.id)
      .eq('is_archived', true)
      .not('folder_id', 'is', null)

    const countMap = new Map<string, number>()
    counts?.forEach(item => {
      if (item.folder_id) {
        countMap.set(item.folder_id, (countMap.get(item.folder_id) || 0) + 1)
      }
    })

    return folders.map(folder => ({
      ...folder,
      item_count: countMap.get(folder.id) || 0
    }))
  }

  /**
   * Obtiene las carpetas organizadas en árbol
   */
  async getFolderTree(): Promise<FolderTree[]> {
    const folders = await this.getUserFolders()
    
    // Construir árbol
    const folderMap = new Map<string, FolderTree>()
    const rootFolders: FolderTree[] = []

    // Primero, crear todos los nodos
    folders.forEach(folder => {
      folderMap.set(folder.id, { ...folder, children: [] })
    })

    // Luego, organizar en árbol
    folders.forEach(folder => {
      const node = folderMap.get(folder.id)!
      if (folder.parent_id && folderMap.has(folder.parent_id)) {
        folderMap.get(folder.parent_id)!.children.push(node)
      } else {
        rootFolders.push(node)
      }
    })

    return rootFolders
  }

  /**
   * Alias para getFolderTree - Obtiene las carpetas organizadas en jerarquía
   */
  async getFolderHierarchy(): Promise<ArchiveFolderWithChildren[]> {
    const tree = await this.getFolderTree()
    // Convertir FolderTree a ArchiveFolderWithChildren (remover item_count)
    const convertToHierarchy = (folders: FolderTree[]): ArchiveFolderWithChildren[] => {
      return folders.map(folder => {
        const { item_count, children, ...rest } = folder
        return {
          ...rest,
          children: children.length > 0 ? convertToHierarchy(children) : undefined
        }
      })
    }
    return convertToHierarchy(tree)
  }

  /**
   * Crea una nueva carpeta
   * @param name - Nombre de la carpeta
   * @param parentId - ID de la carpeta padre (opcional)
   * @param icon - Icono de la carpeta (opcional)
   * @param color - Color de la carpeta (opcional)
   */
  async createFolder(
    name: string,
    parentId?: string,
    icon?: string,
    color?: string
  ): Promise<ArchiveFolder | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    // Obtener la posición máxima actual
    const { data: maxPosData } = await supabase
      .from('archive_folders')
      .select('position')
      .eq('user_id', user.id)
      .eq('parent_id', parentId || null)
      .order('position', { ascending: false })
      .limit(1)
      .single()

    const newPosition = (maxPosData?.position || 0) + 1

    const insertData: ArchiveFolderInsert = {
      user_id: user.id,
      name,
      icon: icon || null,
      color: color || FOLDER_COLORS[0].value,
      parent_id: parentId || null,
      position: newPosition
    }

    const { data, error } = await supabase
      .from('archive_folders')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      console.error('Error creating folder:', error)
      throw error
    }

    return data
  }

  /**
   * Actualiza una carpeta existente
   */
  async updateFolder(
    folderId: string,
    updates: ArchiveFolderUpdate
  ): Promise<ArchiveFolder | null> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return null

    const { data, error } = await supabase
      .from('archive_folders')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', folderId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating folder:', error)
      throw error
    }

    return data
  }

  /**
   * Elimina una carpeta
   * @param folderId - ID de la carpeta a eliminar
   * @param deleteContents - Si es true, elimina también el contenido archivado. Si es false, lo mueve a "Sin carpeta"
   */
  async deleteFolder(folderId: string, deleteContents: boolean = false): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    if (deleteContents) {
      // Eliminar el contenido archivado de la carpeta (quitar el archivo)
      await supabase
        .from('user_content')
        .update({ 
          is_archived: false, 
          archived_at: null, 
          folder_id: null 
        })
        .eq('user_id', user.id)
        .eq('folder_id', folderId)
    } else {
      // Mover todos los items a sin carpeta
      await supabase
        .from('user_content')
        .update({ folder_id: null })
        .eq('user_id', user.id)
        .eq('folder_id', folderId)
    }

    // Mover subcarpetas a root
    await supabase
      .from('archive_folders')
      .update({ parent_id: null })
      .eq('user_id', user.id)
      .eq('parent_id', folderId)

    // Eliminar la carpeta
    const { error } = await supabase
      .from('archive_folders')
      .delete()
      .eq('id', folderId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting folder:', error)
      throw error
    }
  }

  /**
   * Reordena las carpetas
   */
  async reorderFolders(folderIds: string[]): Promise<void> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return

    // Actualizar posiciones
    const updates = folderIds.map((id, index) => 
      supabase
        .from('archive_folders')
        .update({ position: index })
        .eq('id', id)
        .eq('user_id', user.id)
    )

    await Promise.all(updates)
  }

  /**
   * Busca carpetas por nombre
   */
  async searchFolders(query: string): Promise<FolderWithCount[]> {
    const folders = await this.getUserFolders()
    const lowerQuery = query.toLowerCase()
    
    return folders.filter(folder => 
      folder.name.toLowerCase().includes(lowerQuery)
    )
  }

  /**
   * Obtiene el conteo de items sin carpeta
   */
  async getUnfiledCount(): Promise<number> {
    const supabase = this.getClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) return 0

    const { count, error } = await supabase
      .from('user_content')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_archived', true)
      .is('folder_id', null)

    if (error) {
      console.error('Error getting unfiled count:', error)
      return 0
    }

    return count || 0
  }

  /**
   * Importa carpetas desde estructura OPML
   * Retorna un mapa de nombre de carpeta OPML -> ID de carpeta creada
   */
  async importFromOPML(
    folders: { name: string; parentName?: string }[]
  ): Promise<Map<string, string>> {
    const folderMap = new Map<string, string>()
    
    // Obtener carpetas existentes
    const existingFolders = await this.getUserFolders()
    const existingNames = new Map(existingFolders.map(f => [f.name.toLowerCase(), f.id]))

    // Crear carpetas que no existen
    for (const folder of folders) {
      const lowerName = folder.name.toLowerCase()
      
      if (existingNames.has(lowerName)) {
        // Ya existe, usar la existente
        folderMap.set(folder.name, existingNames.get(lowerName)!)
      } else {
        // Crear nueva
        const parentId = folder.parentName 
          ? folderMap.get(folder.parentName) 
          : undefined
        
        const created = await this.createFolder(folder.name, parentId)
        if (created) {
          folderMap.set(folder.name, created.id)
          existingNames.set(lowerName, created.id)
        }
      }
    }

    return folderMap
  }

  /**
   * Exporta las carpetas del usuario en formato OPML
   */
  async exportFoldersAsOPML(): Promise<string> {
    const tree = await this.getFolderTree()
    
    const escapeXML = (str: string): string => {
      return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
    }

    const renderFolder = (folder: FolderTree, indent: number = 2): string => {
      const padding = ' '.repeat(indent)
      const hasChildren = folder.children && folder.children.length > 0
      
      if (hasChildren) {
        const childrenXML = folder.children
          .map(child => renderFolder(child, indent + 2))
          .join('\n')
        return `${padding}<outline text="${escapeXML(folder.name)}" title="${escapeXML(folder.name)}">\n${childrenXML}\n${padding}</outline>`
      } else {
        return `${padding}<outline text="${escapeXML(folder.name)}" title="${escapeXML(folder.name)}" />`
      }
    }

    const foldersXML = tree.map(folder => renderFolder(folder)).join('\n')
    const now = new Date().toISOString()

    return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>Lexora Archive Folders</title>
    <dateCreated>${now}</dateCreated>
    <dateModified>${now}</dateModified>
  </head>
  <body>
${foldersXML}
  </body>
</opml>`
  }
}

export const folderService = new FolderService()
