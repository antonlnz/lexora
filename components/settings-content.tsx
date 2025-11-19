"use client"

import { useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useSubscription } from "@/contexts/subscription-context"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { Bell, Palette, Shield, User, Globe, Eye, Lock, Mail, LogOut, CreditCard, Crown } from "lucide-react"
import { SubscriptionPlans } from "@/components/subscription-plans"

export function SettingsContent() {
  const { logout } = useAuth()
  const { currentPlan, cancelSubscription, autoRenew, setAutoRenew, nextBillingDate, paymentMethod, getSourceLimit } =
    useSubscription()
  const [theme, setTheme] = useState("system")
  const [fontSize, setFontSize] = useState([16])
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

  const handleCancelSubscription = async () => {
    await cancelSubscription()
    setShowCancelDialog(false)
  }

  return (
    <Tabs defaultValue="appearance" className="w-full">
      <TabsList className="glass-card w-full justify-start overflow-x-auto mb-6">
        <TabsTrigger value="appearance" className="hover-lift-subtle">
          <Palette className="h-4 w-4 mr-2" />
          Appearance
        </TabsTrigger>
        <TabsTrigger value="notifications" className="hover-lift-subtle">
          <Bell className="h-4 w-4 mr-2" />
          Notifications
        </TabsTrigger>
        <TabsTrigger value="privacy" className="hover-lift-subtle">
          <Shield className="h-4 w-4 mr-2" />
          Privacy
        </TabsTrigger>
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
        <div className="glass-card p-6 rounded-lg hover-lift">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palette className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Theme</h3>
              <p className="text-sm text-muted-foreground">Customize the visual appearance of the app</p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="theme-select">Color Theme</Label>
              <Select value={theme} onValueChange={setTheme}>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="font-size">Font Size</Label>
                <span className="text-sm text-muted-foreground">{fontSize[0]}px</span>
              </div>
              <Slider
                id="font-size"
                min={12}
                max={24}
                step={1}
                value={fontSize}
                onValueChange={setFontSize}
                className="hover-lift-subtle"
              />
              <p className="text-xs text-muted-foreground">Adjust the base font size for better readability</p>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label htmlFor="font-family">Font Family</Label>
              <Select defaultValue="inter">
                <SelectTrigger id="font-family" className="glass hover-lift-subtle">
                  <SelectValue placeholder="Select font" />
                </SelectTrigger>
                <SelectContent className="glass-card">
                  <SelectItem value="inter">Inter</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="serif">Serif</SelectItem>
                  <SelectItem value="mono">Monospace</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="reduce-motion">Reduce Motion</Label>
                <p className="text-sm text-muted-foreground">Minimize animations and transitions</p>
              </div>
              <Switch id="reduce-motion" className="hover-lift-subtle" />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="high-contrast">High Contrast</Label>
                <p className="text-sm text-muted-foreground">Increase contrast for better visibility</p>
              </div>
              <Switch id="high-contrast" className="hover-lift-subtle" />
            </div>
          </div>
        </div>

        <div className="glass-card p-6 rounded-lg hover-lift">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 rounded-lg bg-primary/10">
              <Eye className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Display</h3>
              <p className="text-sm text-muted-foreground">Control how content is displayed</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="compact-view">Compact View</Label>
                <p className="text-sm text-muted-foreground">Show more content in less space</p>
              </div>
              <Switch id="compact-view" className="hover-lift-subtle" />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="show-images">Show Images</Label>
                <p className="text-sm text-muted-foreground">Display images in content cards</p>
              </div>
              <Switch id="show-images" defaultChecked className="hover-lift-subtle" />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="auto-play">Auto-play Videos</Label>
                <p className="text-sm text-muted-foreground">Automatically play videos when visible</p>
              </div>
              <Switch id="auto-play" className="hover-lift-subtle" />
            </div>
          </div>
        </div>
      </TabsContent>

      {/* Notifications Settings */}
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
      </TabsContent>

      {/* Privacy Settings */}
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
      </TabsContent>

      {/* Subscription Settings */}
      <TabsContent value="subscription" className="space-y-6">
        <div className="glass-card p-6 rounded-lg hover-lift">
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
                  <p className="text-2xl font-bold">${currentPlan === "basic" ? "3.99" : "5.99"}</p>
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
                        Are you sure you want to cancel? You'll lose access to premium features.
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

        <div className="glass-card p-6 rounded-lg hover-lift">
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
        <div className="glass-card p-6 rounded-lg hover-lift">
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

        <div className="glass-card p-6 rounded-lg hover-lift">
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

        <div className="glass-card p-6 rounded-lg hover-lift border-destructive/50">
          <h3 className="text-lg font-semibold text-destructive mb-2">Danger Zone</h3>
          <p className="text-sm text-muted-foreground mb-4">These actions are permanent and cannot be undone</p>
          <div className="space-y-3">
            <Button variant="outline" className="w-full hover-lift-subtle bg-transparent">
              Deactivate Account
            </Button>
            <Button variant="destructive" className="w-full hover-lift-subtle">
              Delete Account
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  )
}
