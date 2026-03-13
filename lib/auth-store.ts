"use client"

import { create } from "zustand"

type AuthStatus = "loading" | "authed" | "guest"

export type AuthUser = {
  id: string
  name?: string
  email?: string
  role: "student" | "admin"
  isMasterAdmin?: boolean
}

type AuthState = {
  status: AuthStatus
  user: AuthUser | null
  setUser: (user: AuthUser | null) => void
  setStatus: (status: AuthStatus) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
  status: "loading",
  user: null,
  setUser: (user) => set({ user, status: user ? "authed" : "guest" }),
  setStatus: (status) => set({ status }),
  logout: () => set({ user: null, status: "guest" }),
}))
