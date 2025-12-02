import { redirect } from "next/navigation"

export default function SettingsPage() {
  // Redirigir a la sección por defecto
  redirect("/settings/appearance")
}
