"use client"

import * as React from "react"
import { parseAsString, useQueryState } from "nuqs"
import { Header } from "@/components/ds/header"
import { UploadCard } from "@/components/ds/uploadcard"
import { ExtensionCard } from "@/components/ds/extension-card"
import { InternshipCard } from "@/components/ds/internshipcard"

const TABS = [
  { id: "Complementar", label: "Complementar" },
  { id: "Extensão", label: "Extensão" },
  { id: "Estágio", label: "Estágio" },
  // { id: "profile", label: "Perfil" },
] as const

type TabId = (typeof TABS)[number]["id"]
const DEFAULT_TAB: TabId = "Complementar"

function isTabId(value: string): value is TabId {
  return TABS.some((tab) => tab.id === value)
}

export default function StudentDashboardLayout() {
  const [tabParam, setTabParam] = useQueryState(
    "tab",
    parseAsString.withDefault(DEFAULT_TAB),
  )
  const activeTabId: TabId = isTabId(tabParam) ? tabParam : DEFAULT_TAB

  React.useEffect(() => {
    if (!isTabId(tabParam)) {
      setTabParam(DEFAULT_TAB, { history: "replace" })
    }
  }, [tabParam, setTabParam])

  return (
    <div className="min-h-screen flex flex-col">
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

      <main className="flex-1 p-4">
        {activeTabId === "Complementar" && (
          <UploadCard
            title="Atividades Complementares"
            endpoint="/api/student/uploads/complementar"
          />
        )}

        {activeTabId === "Extensão" && <ExtensionCard title="Extensão" />}

        {activeTabId === "Estágio" && (
          <InternshipCard
            title="Estágio"
            endpoint="/api/student/internship"
          />
        )}

        {/* {activeTabId === "profile" && (
          <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
            Perfil do aluno (adicione os campos do perfil aqui).
          </div>
        )} */}
      </main>
    </div>
  )
}
