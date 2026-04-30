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
    <header
      className={cn(
        "relative w-full border-b border-border bg-background",
        "flex min-h-16 items-center justify-between gap-4 px-4 py-3",
        className,
      )}
    >
      <div className="flex shrink-0 items-center gap-3">
        <Image
          src="/Ccomp.png"
          alt="Logo"
          width={32}
          height={32}
          className="size-8 object-cover"
        />

      </div>

      <div className="flex flex-1 items-center justify-center">
        {selectedTab ? (
          <Tabs
            value={selectedTab}
            onValueChange={(value) => onTabChange?.(value)}
          >
            {/* <TabsList className="w-full items-center justify-center gap-1">
              {safeTabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  disabled={tab.disabled}
                  className="transition-all duration-300 data-[state=active]:min-w-28 data-[state=inactive]:min-w-fit data-[state=active]:px-3 data-[state=inactive]:px-1 data-[state=active]:text-sm data-[state=inactive]:text-xs data-[state=inactive]:w-7"
                >
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="inline sm:hidden transition-all duration-300 overflow-hidden whitespace-nowrap">
                    {tab.id === selectedTab ? tab.label : tab.label[0]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList> */}
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
                    {/* {!isActive && (
                      <span className="md:hidden flex size-6 shrink-0 items-center justify-center rounded-full ring-1 ring-border bg-muted text-[11px] font-medium text-muted-foreground leading-none">
                        {tab.label[0]}
                      </span>
                    )}

                    <span
                      className={cn(
                        "whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out",
                        isActive ? "max-w-40 opacity-100" : "max-w-0 opacity-0",
                        "md:max-w-40 md:opacity-100",
                      )}
                    >
                      {tab.label}
                    </span> */}
                  </TabsTrigger>
                )
              })}
            </TabsList>
          </Tabs>
        ) : null}
      </div>

      <div className="hidden items-center gap-2 md:flex overflow-hidden">
        {authStatus === "authed" && (
          <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
            {authUser?.name ?? authUser?.email}
          </span>
        )}
        <div className="flex h-9 items-center px-4">
          <Switch
            checked={hydrated ? theme === "dark" : false}
            onCheckedChange={() => toggleTheme()}
            aria-label="Alternar tema"
            disabled={!hydrated}
            className="translate-y-px"
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
            className="size-10 min-w-0 rounded-full p-0 md:hidden"
            aria-label="Abrir menu"
          >
            <MoreHorizontalIcon className="size-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-64 md:hidden"
        >
          {authStatus === "authed" ? (
            <>
              <div className="px-3 py-2">
                <p className="truncate text-sm font-medium">
                  {authUser?.name ?? authUser?.email}
                </p>
                {authUser?.name && authUser?.email ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {authUser.email}
                  </p>
                ) : null}
              </div>
              <DropdownMenuSeparator />
            </>
          ) : null}

          <div className="flex items-center justify-between rounded-xl px-3 py-2 text-sm">
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
