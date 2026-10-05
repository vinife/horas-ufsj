"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { parseAsString, useQueryState } from "nuqs";
import { AdminCard } from "@/components/ds/admincard";
import { Card } from "@/components/ds/card";
import { ExtensionAdminCard } from "@/components/ds/extension-admin-card";
import { Header } from "@/components/ds/header";
import { InternshipAdminCard } from "@/components/ds/internship-admin-card";
import { UsersCard } from "@/components/ds/userscard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthStore } from "@/lib/auth-store";

const TABS = [
  {
    id: "Complementar",
    label: "Complementar",
    permission: "canManageComplementar",
    notificationKey: "complementar",
  },
  {
    id: "Extensão",
    label: "Extensão",
    permission: "canManageExtensao",
    notificationKey: "extensao",
  },
  {
    id: "Estágio",
    label: "Estágio",
    permission: "canManageEstagio",
    notificationKey: "estagio",
  },
  {
    id: "Usuarios",
    label: "Usuários",
    permission: "canManageUsers",
    notificationKey: "usuarios",
  },
] as const;

type TabId = (typeof TABS)[number]["id"];
type PermissionKey = (typeof TABS)[number]["permission"];
type NotificationKey = (typeof TABS)[number]["notificationKey"];

type AdminNotificationCounts = Record<NotificationKey, number>;

const NOTIFICATION_QUERY_KEY = ["admin-notification-counts"] as const;

async function fetchAdminNotificationCounts(): Promise<AdminNotificationCounts> {
  const res = await fetch("/api/admin/notifications", {
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error("Falha ao carregar notificações.");
  }

  const payload = (await res.json()) as Partial<AdminNotificationCounts>;

  return {
    complementar: payload.complementar ?? 0,
    extensao: payload.extensao ?? 0,
    estagio: payload.estagio ?? 0,
    usuarios: payload.usuarios ?? 0,
  };
}

function isTabId(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value);
}

function normalizeTabParam(
  value: string,
  allowedTabIds: TabId[],
): TabId | null {
  if (allowedTabIds.length === 0) return null;

  if (value === "Alunos" || value === "Funcionarios") {
    return allowedTabIds.includes("Usuarios") ? "Usuarios" : allowedTabIds[0];
  }
  if (isTabId(value) && allowedTabIds.includes(value)) return value;
  return allowedTabIds[0];
}

export default function AdminDashboardPage() {
  const authStatus = useAuthStore((state) => state.status);
  const authUser = useAuthStore((state) => state.user);
  const [tabParam, setTabParam] = useQueryState(
    "tab",
    parseAsString.withDefault("Complementar"),
  );

  const { data: notificationCounts } = useQuery({
    queryKey: NOTIFICATION_QUERY_KEY,
    queryFn: fetchAdminNotificationCounts,
    enabled:
      authStatus === "authed" &&
      authUser?.role === "admin" &&
      authUser.hasAnyAdminPermission,
    refetchInterval: 60_000,
  });

  const allowedTabs = React.useMemo(() => {
    if (authStatus !== "authed" || authUser?.role !== "admin") return [];

    return TABS.filter(
      (tab) => authUser.permissions[tab.permission as PermissionKey],
    );
  }, [authStatus, authUser]);

  const allowedTabIds = React.useMemo(
    () => allowedTabs.map((tab) => tab.id),
    [allowedTabs],
  );
  const tabsWithNotifications = React.useMemo(
    () =>
      allowedTabs.map((tab) => ({
        ...tab,
        notificationCount: notificationCounts?.[tab.notificationKey] ?? 0,
      })),
    [allowedTabs, notificationCounts],
  );
  const activeTabId = normalizeTabParam(tabParam, allowedTabIds);

  const showNoPermissionMessage =
    authStatus === "authed" &&
    authUser?.role === "admin" &&
    !authUser.hasAnyAdminPermission;

  React.useEffect(() => {
    if (activeTabId && tabParam !== activeTabId) {
      setTabParam(activeTabId, { history: "replace" });
    }
  }, [tabParam, activeTabId, setTabParam]);

  return (
    <div className="h-screen flex flex-col">
      <Header
        tabs={tabsWithNotifications}
        activeTabId={activeTabId ?? undefined}
        onTabChange={(id) => {
          if (!isTabId(id) || !allowedTabIds.includes(id)) return;
          setTabParam(id, { history: "push" });
        }}
        onLogout={() => {
          window.location.href = "/api/auth/signout";
        }}
      />
      <main className="flex-1 min-h-0 p-4">
        <div className="mx-auto h-full w-full max-w-4xl">
          {authStatus === "loading" ? (
            <Card className="m-0">
              <Card.Header>
                <Skeleton className="h-7 w-64" />
              </Card.Header>
              <Card.Content className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-90 w-full" />
              </Card.Content>
            </Card>
          ) : null}

          {showNoPermissionMessage ? (
            <Card className="m-0">
              <Card.Header>
                <Card.Title>Acesso administrativo pendente</Card.Title>
              </Card.Header>
              <Card.Content className="space-y-3 text-sm text-muted-foreground">
                <p>Requisite acesso ao responsável.</p>
                {authUser.responsibleEmails.length > 0 ? (
                  <div>
                    <p className="mb-1 font-medium text-foreground">
                      Responsáveis cadastrados com acesso ao controle de
                      usuários:
                    </p>
                    <ul className="list-disc pl-5">
                      {authUser.responsibleEmails.map((email) => (
                        <li key={email}>{email}</li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p>
                    Ainda não há responsáveis cadastrados com acesso ao controle
                    de usuários.
                  </p>
                )}
              </Card.Content>
            </Card>
          ) : null}

          {activeTabId === "Complementar" && (
            <AdminCard
              title="Comprovantes de Atividades Complementar"
              endpoint="/api/admin/uploads/complementar"
              uploadType="complementar"
              className="m-0 h-full"
            />
          )}
          {activeTabId === "Extensão" && (
            <ExtensionAdminCard title="Extensão" className="m-0 h-full" />
          )}
          {activeTabId === "Estágio" && (
            <InternshipAdminCard
              title="Estágios em andamento"
              className="m-0 h-full"
            />
          )}
          {activeTabId === "Usuarios" && (
            <UsersCard
              title="Usuários cadastrados e autorizados"
              className="m-0 h-full"
            />
          )}
        </div>
      </main>
    </div>
  );
}
