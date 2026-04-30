import { Suspense } from "react"
import AdminDashboardPage from "./AdminDashboardPage"

export default function AdminPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <AdminDashboardPage />
    </Suspense>
  )
}