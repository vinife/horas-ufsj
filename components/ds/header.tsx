"use client"

import * as React from "react"
import { Button } from "@/components/ds/button"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthStore } from "@/lib/auth-store"
import { cn } from "@/lib/utils"
import { useClientStore } from "@/lib/client-store"
import { useHydrated } from "@/lib/use-hydrated"

type HeaderTab = {
  id: string
  label: string
  disabled?: boolean
}

type HeaderProps = {
  logo?: React.ReactNode
  tabs: HeaderTab[]
  activeTabId?: string
  onTabChange?: (id: string) => void
  onLogout?: () => void
  className?: string
}

export function Header({
  logo,
  tabs,
  activeTabId,
  onTabChange,
  onLogout,
  className,
}: HeaderProps) {
  const hydrated = useHydrated()
  const theme = useClientStore((state) => state.theme)
  const toggleTheme = useClientStore((state) => state.toggleTheme)
  const authStatus = useAuthStore((state) => state.status)
  const authUser = useAuthStore((state) => state.user)
  const setAuthUser = useAuthStore((state) => state.setUser)
  const setAuthStatus = useAuthStore((state) => state.setStatus)

  React.useEffect(() => {
    if (!hydrated) return
    document.documentElement.classList.toggle("dark", theme === "dark")
  }, [hydrated, theme])

  React.useEffect(() => {
    if (!hydrated) return
    if (authStatus !== "loading") return
    let cancelled = false

    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setAuthUser(data?.user ?? null)
      })
      .catch(() => {
        if (cancelled) return
        setAuthStatus("guest")
      })

    return () => {
      cancelled = true
    }
  }, [hydrated, authStatus, setAuthStatus, setAuthUser])

  const safeTabs = tabs
  const selectedTab = activeTabId ?? safeTabs[0]?.id

  return (
    <header
      className={cn(
        "relative w-full border-b border-border bg-background",
        "flex items-center justify-between gap-4 px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-3">
        {logo ?? (
          <span className="text-lg font-semibold text-foreground">
            Horas UFSJ
          </span>
        )}
      </div>

      <div className="absolute left-1/2 -translate-x-1/2">
        {selectedTab ? (
          <Tabs
            value={selectedTab}
            onValueChange={(value) => onTabChange?.(value)}
          >
            <TabsList >
              {safeTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  disabled={tab.disabled}
                  className="min-w-28"
                >
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        {authStatus === "authed" && (
          <span className="hidden text-sm text-muted-foreground md:inline">
            {authUser?.name ?? authUser?.email}
          </span>
        )}
        <div className="px-4">
          <Switch
            checked={hydrated ? theme === "dark" : false}
            onCheckedChange={() => toggleTheme()}
            aria-label="Alternar tema"
            disabled={!hydrated}
          />
        </div>

        <Button
          intent="danger"
          className="min-w-24 "
          onClick={onLogout}
        >
          Sair
        </Button>
      </div>
    </header>
  )
}
