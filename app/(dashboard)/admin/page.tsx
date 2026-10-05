import { Suspense } from "react"
import { Spinner } from "@/components/ui/spinner"
import AdminDashboardPage from "./AdminDashboardPage"

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      }
    >
      <AdminDashboardPage />
    </Suspense>
  )
}