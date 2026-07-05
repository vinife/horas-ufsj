"use client";

import * as React from "react";
import { parseAsString, useQueryState } from "nuqs";
import { AdminCard } from "@/components/ds/admincard";
import { Card } from "@/components/ds/card";
import { Header } from "@/components/ds/header";
import { UsersCard } from "@/components/ds/userscard";
import { useAuthStore } from "@/lib/auth-store";

const TABS = [
  {
    id: "Complementar",
    label: "Complementar",
    permission: "canManageComplementar",
  },
  {
    id: "Extensão",
    label: "Extensão",
    permission: "canManageExtensao",
  },
  { id: "Usuarios", label: "Usuários", permission: "canManageUsers" },
] as const;

type TabId = (typeof TABS)[number]["id"];
type PermissionKey = (typeof TABS)[number]["permission"];

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
        tabs={allowedTabs}
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
            <div className="text-sm text-muted-foreground">
              Carregando permissões...
            </div>
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
              className="m-0 h-full"
            />
          )}
          {activeTabId === "Extensão" && (
            <AdminCard
              title="Comprovantes de Atividades de Extensão"
              endpoint="/api/admin/uploads/extensao"
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
