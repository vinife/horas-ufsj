"use client"

import * as React from "react"
import { notify } from "@/components/ds/notification"
import { useSearchParams } from "next/navigation"
import { Card } from "@/components/ds/card"
import { Button } from "@/components/ds/button"
import Image from "next/image"

function GoogleIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="google-icon"
    >
      <path
        d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.8 4.8 0 0 1-2 3.1v2.6h3.3c1.9-1.7 3-4.3 3-7.5Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.6c-.9.6-2.1 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3v2.7A10 10 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.4 13.9A6 6 0 0 1 6 12c0-.7.1-1.3.4-1.9V7.4H3A10 10 0 0 0 2 12c0 1.7.4 3.3 1 4.6l3.4-2.7Z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9A10 10 0 0 0 3 7.4l3.4 2.7C7.2 7.7 9.4 5.9 12 5.9Z"
        fill="#EA4335"
      />
    </svg>
  )
}

export default function LoginPage() {
  const searchParams = useSearchParams()
  const errorCode = searchParams.get("error")
  const shownErrorRef = React.useRef<string | null>(null)

  React.useEffect(() => {
    if (!errorCode || shownErrorRef.current === errorCode) return

    if (errorCode === "pending-approval") {
      notify.warning(
        "Conta em análise",
        "Sua conta institucional está em análise para aprovação. Volte mais tarde.",
      )
    } else if (errorCode === "access-rejected") {
      notify.error(
        "Acesso negado",
        "Seu acesso foi negado. Entre em contato com um administrador master.",
      )
    } else if (
      errorCode === "unauthorized" ||
      errorCode === "unauthorized-domain"
    ) {
      notify.error(
        "Conta não autorizada",
        "Solicite liberação para um administrador master.",
      )
    }

    shownErrorRef.current = errorCode
  }, [errorCode])

  function loginWithGoogle() {
    window.location.href = "/api/auth/signin/google"
  }

  function loginWithInstitutional() {
    window.location.href = "/api/auth/signin/institucional"
  }

  return (
    <div className="page-login">
      <Card className="page-login__card">
        <Card.Header>
          <Card.Title className="page-login__title">
            Entrega de Certificado de Horas
          </Card.Title>
        </Card.Header>

        <Card.Content className="page-login__content">
          <div className="page-login__logos">
            <Image
              src="/Ccomp.png"
              alt="Logo"
              width={120}
              height={120}
              className="page-login__logo-img"
            />
            <Image
              src="/UFSJ.png"
              alt="Logo UFSJ"
              width={120}
              height={120}
              className="page-login__logo-img"
            />
          </div>

          <Button
            intent="primary"
            className="login-btn-full"
            onClick={loginWithGoogle}
          >
            <GoogleIcon />
            Entrar com Google
          </Button>

          <Button
            intent="secondary"
            className="login-btn-full"
            onClick={loginWithInstitutional}
          >
            <Image
              src="/UFSJ.png"
              alt=""
              width={20}
              height={20}
              className="sso-icon"
            />
            Entrar com SSO
          </Button>
        </Card.Content>
      </Card>
    </div>
  )
}
