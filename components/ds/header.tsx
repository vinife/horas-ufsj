"use client";

import * as React from "react";
import { Button } from "@/components/ds/button";
import { NotificationBadge } from "@/components/ds/notification-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuthStore, type AuthUser } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { useClientStore } from "@/lib/client-store";
import { useHydrated } from "@/lib/use-hydrated";
import { useHeaderResponsiveStage } from "@/components/ds/use-header-responsive-stage";
import { LogOutIcon, MoreHorizontalIcon } from "lucide-react";
import Image from "next/image";
import styles from "./header.module.css";

type HeaderTab = {
  id: string;
  label: string;
  notificationCount?: number;
  disabled?: boolean;
};

type HeaderProps = {
  tabs: HeaderTab[];
  activeTabId?: string;
  onTabChange?: (id: string) => void;
  onLogout?: () => void;
  className?: string;
};

type AuthStatus = "loading" | "authed" | "guest";

type HeaderTabsListProps = {
  tabs: HeaderTab[];
  selectedTab?: string;
  onTabChange?: (id: string) => void;
  compact: boolean;
  hidden?: boolean;
  listRef?: React.Ref<HTMLDivElement>;
};

function HeaderTabsList({
  tabs,
  selectedTab,
  onTabChange,
  compact,
  hidden,
  listRef,
}: HeaderTabsListProps) {
  if (!selectedTab) return null;

  return (
    <Tabs
      value={selectedTab}
      onValueChange={(value) => onTabChange?.(value)}
      aria-hidden={hidden || undefined}
      className={cn(
        hidden && "pointer-events-none invisible absolute left-0 top-0",
      )}
    >
      <TabsList
        ref={listRef}
        className={cn(
          "items-center gap-1 justify-center px-1.5",
          !compact && styles.tabsFull,
        )}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === selectedTab;
          return (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              disabled={tab.disabled}
              className={cn(
                styles.trigger,
                isActive ? styles.triggerActive : styles.triggerInactive,
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
              <NotificationBadge
                count={tab.notificationCount ?? 0}
                className={cn(
                  "self-center",
                  !isActive && (compact ? "hidden" : "hidden md:inline-flex"),
                )}
              />
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

type HeaderRightFullProps = {
  authStatus: AuthStatus;
  authUser: AuthUser | null;
  hydrated: boolean;
  theme: string;
  toggleTheme: () => void;
  onLogout?: () => void;
  hidden?: boolean;
  rootRef?: React.Ref<HTMLDivElement>;
};

function HeaderRightFull({
  authStatus,
  authUser,
  hydrated,
  theme,
  toggleTheme,
  onLogout,
  hidden,
  rootRef,
}: HeaderRightFullProps) {
  return (
    <div
      ref={rootRef}
      aria-hidden={hidden || undefined}
      className={cn(
        "flex items-center gap-2 overflow-hidden justify-self-end",
        hidden && "invisible absolute left-0 top-0 pointer-events-none",
      )}
    >
      {authStatus === "authed" && (
        <span className="max-w-32 truncate text-sm text-muted-foreground">
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

      <Button intent="secondary" className="min-w-24 gap-2" onClick={onLogout}>
        <LogOutIcon />
        Sair
      </Button>
    </div>
  );
}

type HeaderRightNoNameProps = {
  hydrated: boolean;
  theme: string;
  toggleTheme: () => void;
  onLogout?: () => void;
  hidden?: boolean;
  rootRef?: React.Ref<HTMLDivElement>;
};

function HeaderRightNoName({
  hydrated,
  theme,
  toggleTheme,
  onLogout,
  hidden,
  rootRef,
}: HeaderRightNoNameProps) {
  return (
    <div
      ref={rootRef}
      aria-hidden={hidden || undefined}
      className={cn(
        "flex items-center gap-2 overflow-hidden justify-self-end",
        hidden && "invisible absolute left-0 top-0 pointer-events-none",
      )}
    >
      <div className="flex h-9 items-center px-4">
        <Switch
          checked={hydrated ? theme === "dark" : false}
          onCheckedChange={() => toggleTheme()}
          aria-label="Alternar tema"
          disabled={!hydrated}
          className="translate-y-px"
        />
      </div>

      <Button intent="secondary" className="min-w-24 gap-2" onClick={onLogout}>
        <LogOutIcon />
        Sair
      </Button>
    </div>
  );
}

type HeaderRightMobileTriggerProps = {
  hidden?: boolean;
  rootRef?: React.Ref<HTMLButtonElement>;
};

function HeaderRightMobileTrigger({
  hidden,
  rootRef,
}: HeaderRightMobileTriggerProps) {
  return (
    <Button
      ref={rootRef}
      intent="secondary"
      tabIndex={hidden ? -1 : undefined}
      aria-hidden={hidden || undefined}
      className={cn(
        "size-10 min-w-0 justify-self-end rounded-full p-0",
        hidden && "invisible absolute left-0 top-0 pointer-events-none",
      )}
      aria-label="Abrir menu"
    >
      <MoreHorizontalIcon className="size-5" />
    </Button>
  );
}

export function Header({
  tabs,
  activeTabId,
  onTabChange,
  onLogout,
  className,
}: HeaderProps) {
  const hydrated = useHydrated();
  const theme = useClientStore((state) => state.theme);
  const toggleTheme = useClientStore((state) => state.toggleTheme);
  const authStatus = useAuthStore((state) => state.status);
  const authUser = useAuthStore((state) => state.user);
  const setAuthUser = useAuthStore((state) => state.setUser);
  const setAuthStatus = useAuthStore((state) => state.setStatus);

  const headerRef = React.useRef<HTMLElement>(null);
  const logoRef = React.useRef<HTMLDivElement>(null);
  const tabsFullProbeRef = React.useRef<HTMLDivElement>(null);
  const tabsCompactProbeRef = React.useRef<HTMLDivElement>(null);
  const rightFullProbeRef = React.useRef<HTMLDivElement>(null);
  const rightNoNameProbeRef = React.useRef<HTMLDivElement>(null);
  const rightMobileProbeRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!hydrated) return;
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [hydrated, theme]);

  React.useEffect(() => {
    if (!hydrated) return;
    if (authStatus !== "loading") return;
    let cancelled = false;

    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setAuthUser(data?.user ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setAuthStatus("guest");
      });

    return () => {
      cancelled = true;
    };
  }, [hydrated, authStatus, setAuthStatus, setAuthUser]);

  const safeTabs = tabs;
  const selectedTab = activeTabId ?? safeTabs[0]?.id;

  const stage = useHeaderResponsiveStage({
    containerRef: headerRef,
    logoRef,
    tabsFullRef: tabsFullProbeRef,
    tabsCompactRef: tabsCompactProbeRef,
    rightFullRef: rightFullProbeRef,
    rightNoNameRef: rightNoNameProbeRef,
    rightMobileRef: rightMobileProbeRef,
    dependencies: [safeTabs, authUser?.name, authUser?.email],
  });

  return (
    <header
      ref={headerRef}
      className={cn(
        "relative grid w-full grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-background",
        "min-h-16 gap-4 px-4 py-3",
        className,
      )}
    >
      <div ref={logoRef} className="flex min-w-0 items-center gap-3 justify-self-start">
        <Image
          src="/Ccomp.png"
          alt="Logo"
          width={32}
          height={32}
          className="size-8 object-cover"
        />
      </div>

      <div className="flex items-center justify-center justify-self-center">
        <HeaderTabsList
          tabs={safeTabs}
          selectedTab={selectedTab}
          onTabChange={onTabChange}
          compact={stage !== "full"}
        />
      </div>

      {(stage === "full" || stage === "compact-tabs") && (
        <HeaderRightFull
          authStatus={authStatus}
          authUser={authUser}
          hydrated={hydrated}
          theme={theme}
          toggleTheme={toggleTheme}
          onLogout={onLogout}
        />
      )}
      {stage === "compact-tabs-no-name" && (
        <HeaderRightNoName
          hydrated={hydrated}
          theme={theme}
          toggleTheme={toggleTheme}
          onLogout={onLogout}
        />
      )}
      {stage === "mobile" && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              intent="secondary"
              className="size-10 min-w-0 justify-self-end rounded-full p-0"
              aria-label="Abrir menu"
            >
              <MoreHorizontalIcon className="size-5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
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
      )}

      {/* Hidden measurement probes — always mounted so the next resize pass has fresh numbers */}
      <HeaderRightFull
        authStatus={authStatus}
        authUser={authUser}
        hydrated={hydrated}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={onLogout}
        hidden
        rootRef={rightFullProbeRef}
      />
      <HeaderRightNoName
        hydrated={hydrated}
        theme={theme}
        toggleTheme={toggleTheme}
        onLogout={onLogout}
        hidden
        rootRef={rightNoNameProbeRef}
      />
      <HeaderRightMobileTrigger hidden rootRef={rightMobileProbeRef} />
      <HeaderTabsList
        tabs={safeTabs}
        selectedTab={selectedTab}
        onTabChange={undefined}
        compact={false}
        hidden
        listRef={tabsFullProbeRef}
      />
      <HeaderTabsList
        tabs={safeTabs}
        selectedTab={selectedTab}
        onTabChange={undefined}
        compact={true}
        hidden
        listRef={tabsCompactProbeRef}
      />
    </header>
  );
}
