"use client"

import * as React from "react"

export type HeaderStage =
  | "full"
  | "compact-tabs"
  | "compact-tabs-no-name"
  | "mobile"

type UseHeaderResponsiveStageOptions = {
  containerRef: React.RefObject<HTMLElement | null>
  logoRef: React.RefObject<HTMLElement | null>
  tabsFullRef: React.RefObject<HTMLElement | null>
  tabsCompactRef: React.RefObject<HTMLElement | null>
  rightFullRef: React.RefObject<HTMLElement | null>
  rightNoNameRef: React.RefObject<HTMLElement | null>
  rightMobileRef: React.RefObject<HTMLElement | null>
  dependencies?: unknown[]
}

function w(ref: React.RefObject<HTMLElement | null>) {
  return ref.current?.getBoundingClientRect().width ?? 0
}

export function useHeaderResponsiveStage({
  containerRef,
  logoRef,
  tabsFullRef,
  tabsCompactRef,
  rightFullRef,
  rightNoNameRef,
  rightMobileRef,
  dependencies = [],
}: UseHeaderResponsiveStageOptions): HeaderStage {
  const [stage, setStage] = React.useState<HeaderStage>("mobile")

  const recompute = React.useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const available = container.getBoundingClientRect().width
    if (!Number.isFinite(available) || available <= 0) {
      return
    }

    // The header is a `grid-cols-[1fr_auto_1fr]` layout: the left (logo) and
    // right (controls) columns are both `1fr`, so the grid always gives them
    // *equal* track widths regardless of how much either side actually needs.
    // That means the true reserved width for the two edge columns is
    // `2 * max(logoWidth, rightWidth)`, not `logoWidth + rightWidth` — if we
    // only reserved the sum, the narrower (logo) column would "donate" space
    // to the wider (right) column that the grid never actually grants it,
    // and the right-side content (anchored via justify-self-end) would
    // silently overflow past its own track into the center column.
    const logoWidth = w(logoRef)
    const chrome = 32 /* header's own gap-4 x 2 */ + 32 /* header's own px-4 x 2 */ + 24 /* safety buffer */

    const candidates: { stage: HeaderStage; tabs: number; right: number }[] = [
      { stage: "full", tabs: w(tabsFullRef), right: w(rightFullRef) },
      { stage: "compact-tabs", tabs: w(tabsCompactRef), right: w(rightFullRef) },
      {
        stage: "compact-tabs-no-name",
        tabs: w(tabsCompactRef),
        right: w(rightNoNameRef),
      },
      { stage: "mobile", tabs: w(tabsCompactRef), right: w(rightMobileRef) },
    ]

    const fit = candidates.find(
      (candidate) =>
        chrome +
          candidate.tabs +
          2 * Math.max(logoWidth, candidate.right) <=
        available,
    )

    const nextStage = fit?.stage ?? "mobile"
    setStage((prev) => (prev === nextStage ? prev : nextStage))
  }, [
    containerRef,
    logoRef,
    tabsFullRef,
    tabsCompactRef,
    rightFullRef,
    rightNoNameRef,
    rightMobileRef,
  ])

  React.useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      recompute()
    })

    return () => window.cancelAnimationFrame(rafId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recompute, ...dependencies])

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      recompute()
    })

    resizeObserver.observe(container)
    window.addEventListener("resize", recompute)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", recompute)
    }
  }, [recompute, containerRef])

  return stage
}
