"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/auth-context"
import { useSubscription } from "@/contexts/subscription-context"
import { useInterfaceSettingsContext } from "@/contexts/interface-settings-context"
import { useReaderSettings } from "@/hooks/use-reader-settings"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { FontSelector } from "@/components/ui/font-selector"
import { Bell, Palette, Shield, User, Globe, Eye, Lock, Mail, LogOut, CreditCard, Crown, BookOpen, Type, AlignLeft, Monitor, RotateCcw, AlertTriangle, Trash2, Loader2 } from "lucide-react"
import { SubscriptionPlans } from "@/components/subscription-plans"
import { accountService, type AccountDeletionInfo } from "@/lib/services/account-service"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { type SettingsSection } from "@/lib/settings-routes"

interface SettingsContentProps {
  initialSection?: SettingsSection
  initialSubsection?: string
}

export function SettingsContent({ 
  initialSection = "appearance", 
  initialSubsection 
}: SettingsContentProps) {
  const router = useRouter()
  const { logout, user } = useAuth()
  const { currentPlan, cancelSubscription, autoRenew, setAutoRenew, nextBillingDate, paymentMethod, getSourceLimit } =
    useSubscription()
  
  // Referencias para las subsecciones (para scroll automático)
  const themeRef = useRef<HTMLDivElement>(null)
  const displayRef = useRef<HTMLDivElement>(null)
  const readerRef = useRef<HTMLDivElement>(null)
  const currentPlanRef = useRef<HTMLDivElement>(null)
  const availablePlansRef = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)
  const securityRef = useRef<HTMLDivElement>(null)
  const dangerZoneRef = useRef<HTMLDivElement>(null)

  // Mapeo de subsecciones a refs
  const subsectionRefs: Record<string, React.RefObject<HTMLDivElement | null>> = {
    theme: themeRef,
    display: displayRef,
    reader: readerRef,
    "current-plan": currentPlanRef,
    "available-plans": availablePlansRef,
    profile: profileRef,
    security: securityRef,
    "danger-zone": dangerZoneRef,
  }

  const [notifications, setNotifications] = useState({
    email: false,
    push: false,
    newContent: false,
    trending: false,
    weekly: false,
  })
  const [privacy, setPrivacy] = useState({
    analytics: false,
    personalized: false,
    shareData: false,
  })
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  // Estados para eliminación de cuenta
  const [showDeleteConfirmDialog, setShowDeleteConfirmDialog] = useState(false)
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [deletionInfo, setDeletionInfo] = useState<AccountDeletionInfo | null>(null)
  const [loadingDeletionInfo, setLoadingDeletionInfo] = useState(false)

  // Interface settings from context (shared with other components)
  const {
    settings: interfaceSettings,
    updateSetting: updateInterfaceSetting,
    resetSettings: resetInterfaceSettings,
  } = useInterfaceSettingsContext()

  // Reader/Viewer settings from shared hook
  const { 
    settings: readerSettings, 
    updateSetting: updateReaderSetting, 
    resetSettings: resetReaderSettings,
    getFontFamilyCSS 
  } = useReaderSettings()

  // Manejar cambio de tab y actualizar URL
  const handleTabChange = (value: string) => {
    router.push(`/settings/${value}`, { scroll: false })
  }

  // Scroll a la subsección cuando se carga la página
  useEffect(() => {
    if (initialSubsection) {
      const ref = subsectionRefs[initialSubsection]
      if (ref?.current) {
        // Pequeño delay para asegurar que el contenido está renderizado
        setTimeout(() => {
          ref.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 100)
      }
    }
  }, [initialSubsection])

  // Cargar información de eliminación cuando se abre el diálogo
  const handleOpenDeleteDialog = async () => {
    setShowDeleteConfirmDialog(true)
    setLoadingDeletionInfo(true)
    try {
      const info = await accountService.getAccountDeletionInfo()
      setDeletionInfo(info)
    } catch (error) {
      console.error('Error loading deletion info:', error)
    } finally {
      setLoadingDeletionInfo(false)
    }
  }

  // Proceder al paso de contraseña
  const handleProceedToPassword = () => {
    setShowDeleteConfirmDialog(false)
    setShowPasswordDialog(true)
    setDeletePassword("")
  }

  // Cancelar eliminación
  const handleCancelDelete = () => {
    setShowDeleteConfirmDialog(false)
    setShowPasswordDialog(false)
    setDeletePassword("")
    setDeletionInfo(null)
  }

  // Ejecutar eliminación de cuenta
  const handleDeleteAccount = async () => {
    if (!user?.email || !deletePassword) {
      toast.error("Por favor, introduce tu contraseña")
      return
    }

    setIsDeleting(true)
    try {
      const result = await accountService.deleteAccount(user.email, deletePassword)
      
      if (result.success) {
        toast.success("Tu cuenta ha sido eliminada correctamente")
        // El servicio ya hace signOut, redirigir al login
        window.location.href = '/login'
      } else {
        toast.error(result.error || "Error al eliminar la cuenta")
        if (result.error?.includes('Contraseña')) {
          // No cerrar el diálogo si es error de contraseña
          setDeletePassword("")
        }
      }
    } catch (error) {
      console.error('Error deleting account:', error)
      toast.error("Error al eliminar la cuenta")
    } finally {
      setIsDeleting(false)
    }
  }

  // Background color presets
  const backgroundPresets = [
    { name: "White", color: "#ffffff" },
    { name: "Cream", color: "#fefcf3" },
    { name: "Sepia", color: "#f4f1e8" },
    { name: "Light Gray", color: "#f8f9fa" },
    { name: "Warm White", color: "#fdf6e3" },
    { name: "Dark Gray", color: "#1f2937" },
    { name: "Black", color: "#000000" },
  ]

  // Text color presets
  const textColorPresets = [
    { name: "Black", color: "#000000" },
    { name: "Dark Gray", color: "#374151" },
    { name: "Warm Black", color: "#1f2937" },
    { name: "Brown", color: "#92400e" },
    { name: "Blue Gray", color: "#475569" },
    { name: "Light Gray", color: "#d1d5db" },
    { name: "White", color: "#ffffff" },
  ]

  const handleCancelSubscription = async () => {
    await cancelSubscription()
    setShowCancelDialog(false)
  }

  return (
    <Tabs value={initialSection} onValueChange={handleTabChange} className="w-full">
      <TabsList className="glass-card w-full justify-start overflow-x-auto mb-6">
        <TabsTrigger value="appearance" className="hover-lift-subtle">
          <Palette className="h-4 w-4 mr-2" />
          Appearance
        </TabsTrigger>
        {/* <TabsTrigger value="notifications" className="hover-lift-subtle">
          <Bell className="h-4 w-4 mr-2" />
          Notifications
        </TabsTrigger> */}
        {/* <TabsTrigger value="privacy" className="hover-lift-subtle">
          <Shield className="h-4 w-4 mr-2" />
          Privacy
        </TabsTrigger> */}
        <TabsTrigger value="subscription" className="hover-lift-subtle">
          <CreditCard className="h-4 w-4 mr-2" />
          Subscription
        </TabsTrigger>
        <TabsTrigger value="account" className="hover-lift-subtle">
          <User className="h-4 w-4 mr-2" />
          Account
        </TabsTrigger>
      </TabsList>

      {/* Appearance Settings */}
      <TabsContent value="appearance" className="space-y-6">
        <div ref={themeRef} id="theme" className="glass-card p-6 rounded-lg hover-lift scroll-mt-24">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Palette className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Theme</h3>
                <p className="text-sm text-muted-foreground">Customize the visual appearance of the app</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetInterfaceSettings}
              className="glass hover-lift-subtle bg-transparent"
            >
              Reset
            </Button>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="theme-select">Color Theme</Label>
              <Select 
                value={interfaceSettings.themePreference} 
                onValueChange={(value) => updateInterfaceSetting('themePreference', value as 'light' | 'dark' | 'system')}
              >
                <SelectTrigger id="theme-select" className="glass hover-lift-subtle">
                  <SelectValue placeholder="Select theme" />
                </SelectTrigger>
                <SelectContent className="glass-card">
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label htmlFor="font-family">Font Family</Label>
              <FontSelector
                value={interfaceSettings.fontFamily}
                onValueChange={(value) => updateInterfaceSetting('fontFamily', value)}
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="font-size">UI Scale</Label>
                <span className="text-sm text-muted-foreground">{Math.round((interfaceSettings.fontSize / 16) * 100)}%</span>
              </div>
              <Slider
                id="font-size"
                min={12}
                max={24}
                step={1}
                value={[interfaceSettings.fontSize]}
                onValueChange={(val) => updateInterfaceSetting('fontSize', val[0])}
                className="hover-lift-subtle"
              />
              <p className="text-xs text-muted-foreground">Scale the entire interface (75% - 150%)</p>
            </div>
          </div>
        </div>

        {/* Display Settings */}
        <div ref={displayRef} id="display" className="glass-card p-6 rounded-lg hover-lift scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Display</h3>
              <p className="text-sm text-muted-foreground">Control how content is displayed in the feed</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="compact-view">Compact View</Label>
                <p className="text-sm text-muted-foreground">Show more content in less space</p>
              </div>
              <Switch 
                id="compact-view" 
                checked={interfaceSettings.compactView}
                onCheckedChange={(checked) => updateInterfaceSetting('compactView', checked)}
                className="hover-lift-subtle" 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="show-thumbnails">Show Thumbnails</Label>
                <p className="text-sm text-muted-foreground">Display images in content cards</p>
              </div>
              <Switch 
                id="show-thumbnails" 
                checked={interfaceSettings.showThumbnails}
                onCheckedChange={(checked) => updateInterfaceSetting('showThumbnails', checked)}
                className="hover-lift-subtle" 
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="show-excerpts">Show Excerpts</Label>
                <p className="text-sm text-muted-foreground">Display content previews in cards</p>
              </div>
              <Switch 
                id="show-excerpts" 
                checked={interfaceSettings.showExcerpts}
                onCheckedChange={(checked) => updateInterfaceSetting('showExcerpts', checked)}
                className="hover-lift-subtle" 
              />
            </div>
          </div>
        </div>

        {/* Reader Settings */}
        <div ref={readerRef} id="reader" className="glass-card p-6 rounded-lg hover-lift scroll-mt-24">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Reader Settings</h3>
                <p className="text-sm text-muted-foreground">Customize the content viewer appearance</p>
              </div>
            </div>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={resetReaderSettings}
              className="glass hover-lift-subtle bg-transparent"
            >
              Reset
            </Button>
          </div>

          <div className="space-y-6">
            {/* Font Size */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="reader-font-size">Font Size</Label>
                <span className="text-sm text-muted-foreground">{readerSettings.fontSize}px</span>
              </div>
              <Slider
                id="reader-font-size"
                min={12}
                max={24}
                step={1}
                value={[readerSettings.fontSize]}
                onValueChange={(val) => updateReaderSetting('fontSize', val[0])}
                className="hover-lift-subtle"
              />
            </div>

            {/* Font Family */}
            <div className="space-y-3">
              <Label htmlFor="reader-font-family">Font Family</Label>
              <FontSelector
                value={readerSettings.fontFamily}
                onValueChange={(val) => updateReaderSetting('fontFamily', val)}
              />
            </div>

            <Separator />

            {/* Line Height */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="reader-line-height">Line Height</Label>
                <span className="text-sm text-muted-foreground">{readerSettings.lineHeight.toFixed(1)}</span>
              </div>
              <Slider
                id="reader-line-height"
                min={1.2}
                max={2.0}
                step={0.1}
                value={[readerSettings.lineHeight]}
                onValueChange={(val) => updateReaderSetting('lineHeight', parseFloat(val[0].toFixed(1)))}
                className="hover-lift-subtle"
              />
            </div>

            {/* Max Width */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="reader-max-width">Content Width</Label>
                <span className="text-sm text-muted-foreground">{readerSettings.maxWidth}px</span>
              </div>
              <Slider
                id="reader-max-width"
                min={600}
                max={1200}
                step={50}
                value={[readerSettings.maxWidth]}
                onValueChange={(val) => updateReaderSetting('maxWidth', val[0])}
                className="hover-lift-subtle"
              />
            </div>

            <Separator />

            {/* Background Color */}
            <div className="space-y-3">
              <Label>Background Color</Label>
              <div className="flex flex-wrap gap-2">
                {backgroundPresets.map((preset) => (
                  <button
                    key={preset.color}
                    onClick={() => updateReaderSetting('backgroundColor', preset.color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                      readerSettings.backgroundColor === preset.color 
                        ? 'border-primary ring-2 ring-primary/30' 
                        : 'border-border'
                    }`}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                  />
                ))}
                <div className="relative">
                  <input
                    type="color"
                    value={readerSettings.backgroundColor}
                    onChange={(e) => updateReaderSetting('backgroundColor', e.target.value)}
                    className="w-8 h-8 rounded-full border-2 border-border cursor-pointer opacity-0 absolute inset-0"
                  />
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-linear-to-br from-red-500 via-green-500 to-blue-500"
                    title="Custom color"
                  />
                </div>
              </div>
            </div>

            {/* Text Color */}
            <div className="space-y-3">
              <Label>Text Color</Label>
              <div className="flex flex-wrap gap-2">
                {textColorPresets.map((preset) => (
                  <button
                    key={preset.color}
                    onClick={() => updateReaderSetting('textColor', preset.color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                      readerSettings.textColor === preset.color 
                        ? 'border-primary ring-2 ring-primary/30' 
                        : 'border-border'
                    }`}
                    style={{ backgroundColor: preset.color }}
                    title={preset.name}
                  />
                ))}
                <div className="relative">
                  <input
                    type="color"
                    value={readerSettings.textColor}
                    onChange={(e) => updateReaderSetting('textColor', e.target.value)}
                    className="w-8 h-8 rounded-full border-2 border-border cursor-pointer opacity-0 absolute inset-0"
                  />
                  <div 
                    className="w-8 h-8 rounded-full border-2 border-dashed border-border flex items-center justify-center bg-linear-to-br from-red-500 via-green-500 to-blue-500"
                    title="Custom color"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Preview */}
            <div className="space-y-3">
              <Label>Preview</Label>
              <div 
                className="p-4 rounded-lg border"
                style={{ 
                  backgroundColor: readerSettings.backgroundColor,
                  maxWidth: `${Math.min(readerSettings.maxWidth, 500)}px`
                }}
              >
                <p 
                  style={{ 
                    color: readerSettings.textColor,
                    fontSize: `${readerSettings.fontSize}px`,
                    lineHeight: readerSettings.lineHeight,
                    fontFamily: getFontFamilyCSS()
                  }}
                >
                  This is a preview of how your articles will look in the reader. Adjust the settings above to customize your reading experience.
                </p>
              </div>
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Notifications Settings
      <TabsContent value="notifications" className="space-y-6">
        <div className="glass-card p-6 rounded-lg hover-lift">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Notification Preferences</h3>
              <p className="text-sm text-muted-foreground">Choose how you want to be notified</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium">Notification Channels</h4>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="email-notif">Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive updates via email</p>
                </div>
                <Switch
                  id="email-notif"
                  checked={notifications.email}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, email: checked })}
                  className="hover-lift-subtle"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="push-notif">Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive browser push notifications</p>
                </div>
                <Switch
                  id="push-notif"
                  checked={notifications.push}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, push: checked })}
                  className="hover-lift-subtle"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-4">
              <h4 className="text-sm font-medium">Content Notifications</h4>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="new-content">New Content</Label>
                  <p className="text-sm text-muted-foreground">Notify when new content is available</p>
                </div>
                <Switch
                  id="new-content"
                  checked={notifications.newContent}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, newContent: checked })}
                  className="hover-lift-subtle"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="trending">Trending Content</Label>
                  <p className="text-sm text-muted-foreground">Notify about trending topics</p>
                </div>
                <Switch
                  id="trending"
                  checked={notifications.trending}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, trending: checked })}
                  className="hover-lift-subtle"
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label htmlFor="weekly">Weekly Digest</Label>
                  <p className="text-sm text-muted-foreground">Receive a weekly summary of content</p>
                </div>
                <Switch
                  id="weekly"
                  checked={notifications.weekly}
                  onCheckedChange={(checked) => setNotifications({ ...notifications, weekly: checked })}
                  className="hover-lift-subtle"
                />
              </div>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label htmlFor="notification-time">Quiet Hours</Label>
              <Select defaultValue="none">
                <SelectTrigger id="notification-time" className="glass hover-lift-subtle">
                  <SelectValue placeholder="Select quiet hours" />
                </SelectTrigger>
                <SelectContent className="glass-card">
                  <SelectItem value="none">No quiet hours</SelectItem>
                  <SelectItem value="night">Night (10 PM - 8 AM)</SelectItem>
                  <SelectItem value="work">Work hours (9 AM - 5 PM)</SelectItem>
                  <SelectItem value="custom">Custom</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </TabsContent> */}

      {/* Privacy Settings
      <TabsContent value="privacy" className="space-y-6">
        <div className="glass-card p-6 rounded-lg hover-lift">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Privacy & Data</h3>
              <p className="text-sm text-muted-foreground">Control your data and privacy settings</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="analytics">Analytics</Label>
                <p className="text-sm text-muted-foreground">Help improve Lexora with usage data</p>
              </div>
              <Switch
                id="analytics"
                checked={privacy.analytics}
                onCheckedChange={(checked) => setPrivacy({ ...privacy, analytics: checked })}
                className="hover-lift-subtle"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="personalized">Personalized Content</Label>
                <p className="text-sm text-muted-foreground">Show content based on your interests</p>
              </div>
              <Switch
                id="personalized"
                checked={privacy.personalized}
                onCheckedChange={(checked) => setPrivacy({ ...privacy, personalized: checked })}
                className="hover-lift-subtle"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="share-data">Share Data with Partners</Label>
                <p className="text-sm text-muted-foreground">Allow data sharing with trusted partners</p>
              </div>
              <Switch
                id="share-data"
                checked={privacy.shareData}
                onCheckedChange={(checked) => setPrivacy({ ...privacy, shareData: checked })}
                className="hover-lift-subtle"
              />
            </div>

            <Separator />

            <div className="space-y-3">
              <Label htmlFor="data-retention">Data Retention</Label>
              <Select defaultValue="3months">
                <SelectTrigger id="data-retention" className="glass hover-lift-subtle">
                  <SelectValue placeholder="Select retention period" />
                </SelectTrigger>
                <SelectContent className="glass-card">
                  <SelectItem value="3months">3 months</SelectItem>
                  <SelectItem value="6months">6 months</SelectItem>
                  <SelectItem value="1year">1 year</SelectItem>
                  <SelectItem value="forever">Forever</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">How long to keep your reading history</p>
            </div>

            <Separator />

            <div className="space-y-3">
              <Button variant="outline" className="w-full glass hover-lift-subtle bg-transparent">
                <Lock className="h-4 w-4 mr-2" />
                Download My Data
              </Button>
              <Button variant="destructive" className="w-full hover-lift-subtle">
                Delete All Data
              </Button>
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-lg hover-lift">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Content Filtering</h3>
              <p className="text-sm text-muted-foreground">Control what content you see</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="nsfw">Hide Sensitive Content</Label>
                <p className="text-sm text-muted-foreground">Filter potentially sensitive material</p>
              </div>
              <Switch id="nsfw" defaultChecked className="hover-lift-subtle" />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="spoilers">Hide Spoilers</Label>
                <p className="text-sm text-muted-foreground">Blur content marked as spoilers</p>
              </div>
              <Switch id="spoilers" className="hover-lift-subtle" />
            </div>
          </div>
        </div>
      </TabsContent> */}

      {/* Subscription Settings */}
      <TabsContent value="subscription" className="space-y-6">
        <div ref={currentPlanRef} id="current-plan" className="glass-card p-6 rounded-lg hover-lift scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Crown className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Current Plan</h3>
              <p className="text-sm text-muted-foreground">Manage your subscription and billing</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg glass">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-xl font-semibold capitalize">{currentPlan}</h4>
                  {currentPlan !== "free" && <Badge className="bg-primary text-primary-foreground">Active</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{getSourceLimit()} content sources available</p>
              </div>
              {currentPlan !== "free" && (
                <div className="text-right">
                  <p className="text-2xl font-bold">${currentPlan === "pro" ? "3.99" : "0"}</p>
                  <p className="text-sm text-muted-foreground">/month</p>
                </div>
              )}
            </div>

            {currentPlan !== "free" && (
              <>
                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label>Auto-Renew</Label>
                      <p className="text-sm text-muted-foreground">Automatically renew your subscription</p>
                    </div>
                    <Switch checked={autoRenew} onCheckedChange={setAutoRenew} className="hover-lift-subtle" />
                  </div>

                  {nextBillingDate && (
                    <div className="p-4 rounded-lg glass">
                      <p className="text-sm text-muted-foreground mb-1">Next Billing Date</p>
                      <p className="font-semibold">{new Date(nextBillingDate).toLocaleDateString()}</p>
                    </div>
                  )}

                  {paymentMethod && (
                    <div className="p-4 rounded-lg glass">
                      <p className="text-sm text-muted-foreground mb-1">Payment Method</p>
                      <p className="font-semibold">Card ending in {paymentMethod}</p>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <Button variant="outline" className="w-full glass hover-lift-subtle bg-transparent">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Update Payment Method
                  </Button>

                  {!showCancelDialog ? (
                    <Button
                      variant="outline"
                      onClick={() => setShowCancelDialog(true)}
                      className="w-full glass hover-lift-subtle bg-transparent text-destructive hover:text-destructive"
                    >
                      Cancel Subscription
                    </Button>
                  ) : (
                    <div className="p-4 rounded-lg glass border-destructive/50 space-y-3">
                      <p className="text-sm text-muted-foreground">
                        Are you sure you want to cancel? You'll lose access to Pro features.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="outline" onClick={() => setShowCancelDialog(false)} className="flex-1">
                          Keep Plan
                        </Button>
                        <Button variant="destructive" onClick={handleCancelSubscription} className="flex-1">
                          Confirm Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div ref={availablePlansRef} id="available-plans" className="glass-card p-6 rounded-lg hover-lift scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <CreditCard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Available Plans</h3>
              <p className="text-sm text-muted-foreground">
                {currentPlan === "free" ? "Upgrade to unlock more features" : "Change your subscription plan"}
              </p>
            </div>
          </div>

          <SubscriptionPlans showCurrentPlan />
        </div>
      </TabsContent>

      {/* Account Settings */}
      <TabsContent value="account" className="space-y-6">
        <div ref={profileRef} id="profile" className="glass-card p-6 rounded-lg hover-lift scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Profile Information</h3>
              <p className="text-sm text-muted-foreground">Manage your account details</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="display-name">Display Name</Label>
              <input
                id="display-name"
                type="text"
                placeholder="Your name"
                className="w-full px-4 py-2 rounded-lg glass border border-glass-border focus:outline-none focus:ring-2 focus:ring-ring hover-lift-subtle"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <input
                id="email"
                type="email"
                placeholder="your@email.com"
                className="w-full px-4 py-2 rounded-lg glass border border-glass-border focus:outline-none focus:ring-2 focus:ring-ring hover-lift-subtle"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select defaultValue="en">
                <SelectTrigger id="language" className="glass hover-lift-subtle">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent className="glass-card">
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <Button className="w-full hover-lift-subtle">
              <Mail className="h-4 w-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>

        <div ref={securityRef} id="security" className="glass-card p-6 rounded-lg hover-lift scroll-mt-24">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Security</h3>
              <p className="text-sm text-muted-foreground">Manage your account security</p>
            </div>
          </div>

          <div className="space-y-4">
            <Button variant="outline" className="w-full glass hover-lift-subtle bg-transparent">
              Change Password
            </Button>
            <Button variant="outline" className="w-full glass hover-lift-subtle bg-transparent">
              Enable Two-Factor Authentication
            </Button>
            <Button variant="outline" className="w-full glass hover-lift-subtle bg-transparent">
              Manage Sessions
            </Button>
            <Separator />
            <Button
              variant="outline"
              onClick={logout}
              className="w-full glass hover-lift-subtle bg-transparent text-destructive hover:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        <div ref={dangerZoneRef} id="danger-zone" className="glass-card p-6 rounded-lg hover-lift scroll-mt-24 border-destructive/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-destructive">Danger Zone</h3>
              <p className="text-sm text-muted-foreground">These actions are permanent and cannot be undone</p>
            </div>
          </div>
          <div className="space-y-3">
            <Button 
              variant="destructive" 
              className="w-full hover-lift-subtle"
              onClick={handleOpenDeleteDialog}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </div>
        </div>
      </TabsContent>

      {/* Diálogo de confirmación inicial */}
      <AlertDialog open={showDeleteConfirmDialog} onOpenChange={setShowDeleteConfirmDialog}>
        <AlertDialogContent className="bg-background border max-w-lg">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl">¿Eliminar tu cuenta?</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p className="text-base">
                  Esta acción es <strong className="text-destructive">permanente e irreversible</strong>. 
                  Se eliminarán todos tus datos de Lexora.
                </p>
                
                {loadingDeletionInfo ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : deletionInfo && (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                    <p className="font-medium text-foreground mb-2">Se eliminará:</p>
                    <ul className="space-y-1.5 text-muted-foreground">
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-destructive/60" />
                        <span>{deletionInfo.sourcesCount} fuentes suscritas</span>
                      </li>
                      {deletionInfo.exclusiveSourcesCount > 0 && (
                        <li className="flex items-center gap-2 text-destructive">
                          <span className="w-2 h-2 rounded-full bg-destructive" />
                          <span>{deletionInfo.exclusiveSourcesCount} fuentes exclusivas (y todo su contenido)</span>
                        </li>
                      )}
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-destructive/60" />
                        <span>{deletionInfo.contentToDelete} interacciones con contenido</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-destructive/60" />
                        <span>{deletionInfo.archivedItems} items archivados</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-destructive/60" />
                        <span>{deletionInfo.folders} carpetas de archivo</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-destructive/60" />
                        <span>{deletionInfo.collections} colecciones</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-destructive/60" />
                        <span>Tu perfil y todas las configuraciones</span>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel onClick={handleCancelDelete} className="hover-lift-subtle">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleProceedToPassword}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 hover-lift-subtle"
            >
              Continuar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de contraseña */}
      <AlertDialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <AlertDialogContent className="bg-background border max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-3 rounded-full bg-destructive/10">
                <Lock className="h-6 w-6 text-destructive" />
              </div>
              <AlertDialogTitle className="text-xl">Confirma tu identidad</AlertDialogTitle>
            </div>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-muted-foreground">
                <p>
                  Por seguridad, introduce tu contraseña para confirmar la eliminación de tu cuenta.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="delete-password" className="text-foreground">Contraseña</Label>
                  <Input
                    id="delete-password"
                    type="password"
                    placeholder="Tu contraseña actual"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    disabled={isDeleting}
                    autoFocus
                  />
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel onClick={handleCancelDelete} disabled={isDeleting} className="hover-lift-subtle">
              Cancelar
            </AlertDialogCancel>
            <Button
              onClick={handleDeleteAccount}
              disabled={isDeleting || !deletePassword}
              variant="destructive"
              className="hover-lift-subtle"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Eliminando...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar cuenta permanentemente
                </>
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  )
}
