"use client"

import { Header } from "@/components/ds/header"
import { UploadCard } from "@/components/ds/uploadcard"

export default function StudentDashboardLayout()
// ({ children }: { children: React.ReactNode })
{
  return (
    <div className="min-h-screen flex flex-col">
      <Header
        tabs={[
          { id: "dashboard", label: "Dashboard" },
          { id: "activities", label: "Atividades" },
          { id: "profile", label: "Perfil" },
        ]}
        activeTabId="dashboard"
        onTabChange={(id) => {
          window.location.href = `/student/${id === "dashboard" ? "" : id}`;
        }}
        onLogout={() => {
          window.location.href = "/api/auth/signout";
        }}
      />
      <UploadCard className="m-4" />

      {/* <main className="flex-1 p-4">{children}</main> */}
    </div>
  );
}