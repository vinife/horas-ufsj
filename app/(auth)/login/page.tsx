"use client"

import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ds/card"
import { Button } from "@/components/ds/button"

export default function LoginPage() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get("error")

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
          {errorCode === "pending-approval" ? (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">
              Sua conta institucional está em análise para aprovação. Volte mais tarde.
            </div>
          ) : null}

          {errorCode === "access-rejected" ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Seu acesso foi negado. Entre em contato com um administrador master.
            </div>
          ) : null}

          {errorCode === "unauthorized" || errorCode === "unauthorized-domain" ? (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              Conta não autorizada. Solicite liberação para um administrador master.
            </div>
          ) : null}

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
