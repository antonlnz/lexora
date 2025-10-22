import { Navigation } from "@/components/navigation"
import { SettingsContent } from "@/components/settings-content"

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />

      <div className="pt-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <h1 className="text-3xl font-playfair font-bold text-balance mb-2">Settings</h1>
            <p className="text-muted-foreground">
              Manage your account preferences and customize your Lexora experience.
            </p>
          </div>

          <SettingsContent />
        </div>
      </div>
    </div>
  )
}
