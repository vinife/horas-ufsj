'use client' // <--- 1. A Fronteira

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState } from 'react'

export default function Providers({ children }: { children: React.ReactNode }) {

  // 2. O "Cérebro" (Cache)
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // 3. Configuração de "Preguiça" (Stale Time)
        staleTime: 60 * 1000,
      },
    },
  }))

  return (
    // 4. A "Antena" (Provider)
    <QueryClientProvider client={queryClient}>
      {children}
      {/* 5. O Raio-X (DevTools) */}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}