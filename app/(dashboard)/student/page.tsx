import { Suspense } from "react"
import { Spinner } from "@/components/ui/spinner"
import StudentDashboardLayout from "./StudentDashboardLayout"

export default function StudentPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Spinner className="size-6 text-muted-foreground" />
        </div>
      }
    >
      <StudentDashboardLayout />
    </Suspense>
  )
}