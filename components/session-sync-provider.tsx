"use client"

import { useSessionSync } from "@/hooks/use-session-sync"

export function SessionSyncProvider({ children }: { children: React.ReactNode }) {
  useSessionSync()
  return <>{children}</>
}
