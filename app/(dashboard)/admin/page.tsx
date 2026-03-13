"use client"

import * as React from "react"
import { parseAsString, useQueryState } from "nuqs"
import { AdminCard } from "@/components/ds/admincard"
import { Header } from "@/components/ds/header"
import { UsersCard } from "@/components/ds/userscard"

const TABS = [
  { id: "Complementar", label: "Complementar" },
  { id: "Extensão", label: "Extensão" },
  { id: "Usuarios", label: "Usuários" },
] as const

type TabId = (typeof TABS)[number]["id"]
const DEFAULT_TAB: TabId = "Complementar"

function isTabId(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

function normalizeTabParam(value: string): TabId {
  if (value === "Alunos" || value === "Funcionarios") {
    return "Usuarios"
  }
  if (isTabId(value)) return value
  return DEFAULT_TAB
}

export default function AdminDashboardPage() {
  const [tabParam, setTabParam] = useQueryState(
    "tab",
    parseAsString.withDefault(DEFAULT_TAB),
  )
  const activeTabId = normalizeTabParam(tabParam)

  React.useEffect(() => {
    if (tabParam !== activeTabId) {
      setTabParam(activeTabId, { history: "replace" })
    }
  }, [tabParam, activeTabId, setTabParam])

  return (
    <div className="h-screen flex flex-col">
      <Header
        tabs={[...TABS]}
        activeTabId={activeTabId}
        onTabChange={(id) => {
          if (!isTabId(id)) return
          setTabParam(id, { history: "push" })
        }}
        onLogout={() => {
          window.location.href = "/api/auth/signout"
        }}
      />
      <main className="flex-1 min-h-0 p-4">
        <div className="mx-auto h-full w-full max-w-4xl">
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
  )
}
