"use client"

import * as React from "react"
import { Button } from "@/components/ds/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuthStore } from "@/lib/auth-store"
import { cn } from "@/lib/utils"
import { useClientStore } from "@/lib/client-store"
import { useHydrated } from "@/lib/use-hydrated"
import { LogOutIcon, MoreHorizontalIcon } from "lucide-react"
import Image from "next/image"
import styles from "./header.module.css"

type HeaderTab = {
  id: string
  label: string
  disabled?: boolean
}

type HeaderProps = {
  tabs: HeaderTab[]
  activeTabId?: string
  onTabChange?: (id: string) => void
  onLogout?: () => void
  className?: string
}

export function Header({
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
    <header className={cn("ds-header", className)}>
      <div className="ds-header__brand">
        <Image
          src="/Ccomp.png"
          alt="Logo"
          width={32}
          height={32}
          className="ds-header__logo"
        />
      </div>

      <div className="ds-header__tabs-wrap">
        {selectedTab ? (
          <Tabs
            value={selectedTab}
            onValueChange={(value) => onTabChange?.(value)}
          >
            <TabsList className="items-center gap-1 justify-center px-1.5">
              {safeTabs.map((tab) => {
                const isActive = tab.id === selectedTab
                return (
                  <TabsTrigger
                    key={tab.id}
                    value={tab.id}
                    disabled={tab.disabled}
                    className={cn(
                      styles.trigger,
                      isActive
                        ? styles.triggerActive
                        : styles.triggerInactive,
                    )}
                  >
                    <span
                      className={cn(
                        styles.avatar,
                        isActive ? styles.avatarActive : styles.avatarInactive,
                      )}
                      aria-hidden
                    >
                      {tab.label[0]}
                    </span>

                    <span
                      className={cn(
                        styles.label,
                        isActive ? styles.labelActive : styles.labelInactive,
                      )}
                    >
                      {tab.label}
                    </span>
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      <div className="ds-header__desktop">
        {authStatus === "authed" && (
          <span className="ds-header__user">
            {authUser?.name ?? authUser?.email}
          </span>
        )}
        <div className="ds-header__theme-wrap">
          <Switch
            checked={hydrated ? theme === "dark" : false}
            onCheckedChange={() => toggleTheme()}
            aria-label="Alternar tema"
            disabled={!hydrated}
            className="ds-header__switch-nudge"
          />
        </div>

        <Button
          intent="tertiary"
          className="min-w-24 gap-2"
          onClick={onLogout}
        >
          <LogOutIcon />
          Sair
        </Button>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            intent="secondary"
            className="ds-header__menu-trigger"
            aria-label="Abrir menu"
          >
            <MoreHorizontalIcon />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64 md:hidden">
          {authStatus === "authed" ? (
            <>
              <div className="ds-header__dropdown-head">
                <p className="ds-header__dropdown-name">
                  {authUser?.name ?? authUser?.email}
                </p>
                {authUser?.name && authUser?.email ? (
                  <p className="ds-header__dropdown-email">{authUser.email}</p>
                ) : null}
              </div>
              <DropdownMenuSeparator />
            </>
          ) : null}

          <div className="ds-header__dropdown-theme-row">
            <span>Modo escuro</span>
            <Switch
              checked={hydrated ? theme === "dark" : false}
              onCheckedChange={() => toggleTheme()}
              aria-label="Alternar tema"
              disabled={!hydrated}
            />
          </div>

          {onLogout ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onLogout()}
              >
                <LogOutIcon />
                Sair
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
