"use client"

import { Card } from "@/components/ds/card"
import { Button } from "@/components/ds/button"

export default function LoginPage() {
  function loginWithGoogle() {
    window.location.href = "/api/auth/signin/google"
  }

  function loginWithInstitutional() {
    window.location.href = "/api/auth/signin/institucional"
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <Card.Header>
          <Card.Title className="text-center">
            Entrar na plataforma
          </Card.Title>
        </Card.Header>

        <Card.Content className="space-y-4">
          <Button
            intent="primary"
            className="w-full"
            onClick={loginWithGoogle}
          >
            Entrar com Google
          </Button>

          <Button
            intent="secondary"
            className="w-full"
            onClick={loginWithInstitutional}
          >
            Entrar com login institucional
          </Button>
        </Card.Content>
      </Card>
    </div>
  )
}
