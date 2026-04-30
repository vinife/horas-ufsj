import { Suspense } from "react"
import StudentDashboardLayout from "./StudentDashboardLayout"

export default function StudentPage() {
  return (
    <Suspense fallback={<div>Carregando...</div>}>
      <StudentDashboardLayout />
    </Suspense>
  )
}