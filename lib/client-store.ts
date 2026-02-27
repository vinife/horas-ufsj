"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"

type Theme = "light" | "dark"

type ClientState = {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

export const useClientStore = create<ClientState>()(
  persist(
    (set, get) => ({
      theme: "light",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set({ theme: get().theme === "dark" ? "light" : "dark" }),
    }),
    {
      name: "client-state",
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
)
