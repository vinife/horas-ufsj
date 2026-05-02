"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react"

type AutoPageSizeOptions = {
  tableViewportRef: React.RefObject<HTMLDivElement>
  setPageSize: React.Dispatch<React.SetStateAction<number>>
  minPageSize?: number
  maxPageSize?: number
  dependencies?: React.DependencyList
}

type PaginationControlsProps = {
  currentPage: number
  totalPages: number
  onPageChange: (page: number) => void
  isLoading?: boolean
}

function getPageLinks(currentPage: number, totalPages: number) {
  if (totalPages <= 1) return [1]
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }
  if (currentPage <= 3) return [1, 2, 3, 4, "ellipsis", totalPages] as const
  if (currentPage >= totalPages - 2) {
    return [1, "ellipsis", totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const
  }
  return [
    1,
    "ellipsis",
    currentPage - 1,
    currentPage,
    currentPage + 1,
    "ellipsis",
    totalPages,
  ] as const
}

export function useAutoPageSize({
  tableViewportRef,
  setPageSize,
  minPageSize = 5,
  maxPageSize = 50,
  dependencies = [],
}: AutoPageSizeOptions) {
  const recomputePageSize = React.useCallback(() => {
    const viewport = tableViewportRef.current
    if (!viewport) return

    const viewportHeight = viewport.getBoundingClientRect().height
    if (!Number.isFinite(viewportHeight) || viewportHeight < 180) {
      return
    }

    const tableHead = viewport.querySelector("thead")
    const firstRow = viewport.querySelector("tbody tr")

    const headerHeight = tableHead?.getBoundingClientRect().height ?? 48
    const rowHeight = firstRow?.getBoundingClientRect().height ?? 52
    const availableRowsSpace = viewportHeight - headerHeight
    const estimatedRows = Math.floor(availableRowsSpace / Math.max(1, rowHeight))
    const nextPageSize = Math.max(
      minPageSize,
      Math.min(maxPageSize, estimatedRows),
    )

    setPageSize((prev) => (prev === nextPageSize ? prev : nextPageSize))
  }, [tableViewportRef, setPageSize, maxPageSize, minPageSize])

  React.useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      recomputePageSize()
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [recomputePageSize, ...dependencies])

  React.useEffect(() => {
    const viewport = tableViewportRef.current
    if (!viewport) return

    const resizeObserver = new ResizeObserver(() => {
      recomputePageSize()
    })

    resizeObserver.observe(viewport)
    window.addEventListener("resize", recomputePageSize)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", recomputePageSize)
    }
  }, [recomputePageSize])
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPageChange,
  isLoading = false,
}: PaginationControlsProps) {
  const [stableTotalPages, setStableTotalPages] = React.useState(
    Math.max(1, totalPages),
  )

  React.useEffect(() => {
    if (isLoading) return
    setStableTotalPages(Math.max(1, totalPages))
  }, [isLoading, totalPages])

  const safeTotalPages = Math.max(1, stableTotalPages)
  const safeCurrentPage = Math.min(Math.max(1, currentPage), safeTotalPages)

  React.useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      onPageChange(safeCurrentPage)
    }
  }, [currentPage, onPageChange, safeCurrentPage])

  const pageLinks = React.useMemo(
    () => getPageLinks(safeCurrentPage, safeTotalPages),
    [safeCurrentPage, safeTotalPages],
  )

  if (safeTotalPages <= 1) return null

  return (
    <nav role="navigation" aria-label="Paginação" data-slot="pagination">
      <ul data-slot="pagination-content">
        <li data-slot="pagination-item">
          <button
            type="button"
            className="ui-button"
            data-slot="pagination-link"
            data-variant="ghost"
            data-size="default"
            data-pagination="prev"
            aria-label="Ir para a página anterior"
            aria-disabled={safeCurrentPage <= 1}
            disabled={safeCurrentPage <= 1}
            onClick={() => {
              if (safeCurrentPage <= 1) return
              onPageChange(safeCurrentPage - 1)
            }}
          >
            <ChevronLeftIcon data-icon="inline-start" />
            <span className="u-pagination-text">Anterior</span>
          </button>
        </li>

        {pageLinks.map((value, index) => (
          <li data-slot="pagination-item" key={`${value}-${index}`}>
            {value === "ellipsis" ? (
              <span aria-hidden data-slot="pagination-ellipsis">
                <MoreHorizontalIcon />
                <span className="sr-only">Mais páginas</span>
              </span>
            ) : (
              <button
                type="button"
                className="ui-button"
                data-slot="pagination-link"
                data-variant={value === safeCurrentPage ? "outline" : "ghost"}
                data-size="icon"
                aria-label={`Ir para a página ${value}`}
                aria-current={value === safeCurrentPage ? "page" : undefined}
                onClick={() => {
                  if (value === safeCurrentPage) return
                  onPageChange(value)
                }}
              >
                {value}
              </button>
            )}
          </li>
        ))}

        <li data-slot="pagination-item">
          <button
            type="button"
            className="ui-button"
            data-slot="pagination-link"
            data-variant="ghost"
            data-size="default"
            data-pagination="next"
            aria-label="Ir para a próxima página"
            aria-disabled={safeCurrentPage >= safeTotalPages}
            disabled={safeCurrentPage >= safeTotalPages}
            onClick={() => {
              if (safeCurrentPage >= safeTotalPages) return
              onPageChange(safeCurrentPage + 1)
            }}
          >
            <span className="u-pagination-text">Próxima</span>
            <ChevronRightIcon data-icon="inline-end" />
          </button>
        </li>
      </ul>
    </nav>
  )
}
