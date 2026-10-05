"use client";

import * as React from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import {
  ChevronLeft,
  ChevronRight,
  ImageOff,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Button } from "@/components/ds/button";
import { FileViewerErrorBoundary } from "@/components/ds/file-viewer-error-boundary";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

const FileViewerPdf = dynamic(() => import("./file-viewer-pdf"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center p-6">
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  ),
});

type FileViewerProps = {
  fileUrl: string;
  fileName?: string;
  className?: string;
};

type PreviewMode = "image" | "pdf" | "error";

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const ZOOM_STEP = 0.25;

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

function FileViewerContent({ fileUrl, fileName, className }: FileViewerProps) {
  const trimmedUrl = fileUrl?.trim() ?? "";

  const [mode, setMode] = React.useState<PreviewMode>("image");
  const [numPages, setNumPages] = React.useState(0);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [scale, setScale] = React.useState(1);
  const [translate, setTranslate] = React.useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = React.useState(false);
  const [containerWidth, setContainerWidth] = React.useState(0);

  const frameRef = React.useRef<HTMLDivElement>(null);
  const dragStateRef = React.useRef<DragState | null>(null);

  React.useEffect(() => {
    setMode("image");
    setNumPages(0);
    setCurrentPage(1);
    setScale(1);
    setTranslate({ x: 0, y: 0 });
  }, [fileUrl]);

  React.useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      setContainerWidth(entry.contentRect.width);
    });

    resizeObserver.observe(frame);
    setContainerWidth(frame.getBoundingClientRect().width);

    return () => resizeObserver.disconnect();
  }, []);

  const clampTranslate = React.useCallback(
    (value: { x: number; y: number }, nextScale: number) => {
      const frame = frameRef.current;
      if (!frame || nextScale <= 1) return { x: 0, y: 0 };

      const rect = frame.getBoundingClientRect();
      const maxX = (rect.width * (nextScale - 1)) / 2;
      const maxY = (rect.height * (nextScale - 1)) / 2;

      return {
        x: Math.min(maxX, Math.max(-maxX, value.x)),
        y: Math.min(maxY, Math.max(-maxY, value.y)),
      };
    },
    [],
  );

  const zoomIn = () => {
    setScale((prev) => {
      const next = Math.min(MAX_SCALE, prev + ZOOM_STEP);
      setTranslate((current) => clampTranslate(current, next));
      return next;
    });
  };

  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(MIN_SCALE, prev - ZOOM_STEP);
      setTranslate((current) => clampTranslate(current, next));
      return next;
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (scale <= 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: translate.x,
      originY: translate.y,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    setTranslate(
      clampTranslate(
        { x: dragState.originX + deltaX, y: dragState.originY + deltaY },
        scale,
      ),
    );
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    setIsDragging(false);
  };

  const canRenderImage = trimmedUrl.length > 0 && mode === "image";
  const canRenderPdf = trimmedUrl.length > 0 && mode === "pdf";
  const showEmptyState = mode === "error" || trimmedUrl.length === 0;
  const showPageNav = mode === "pdf" && numPages > 1;

  const transformStyle: React.CSSProperties = {
    transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`,
    transition: isDragging ? "none" : "transform 150ms ease-out",
    cursor: scale > 1 ? (isDragging ? "grabbing" : "grab") : "default",
  };

  return (
    <div
      className={cn("flex h-full w-full min-h-0 flex-col gap-2", className)}
    >
      <div
        ref={frameRef}
        className="relative flex min-h-0 flex-1 touch-none items-center justify-center overflow-hidden rounded-lg border bg-muted/20"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {showEmptyState ? (
          <div className="flex w-full flex-col items-center justify-center gap-3 p-6 text-center text-muted-foreground">
            <ImageOff className="h-10 w-10" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">
                Não foi possível carregar o arquivo
              </p>
              <p className="text-xs">
                Verifique se o arquivo possui uma URL válida.
              </p>
            </div>
          </div>
        ) : canRenderImage ? (
          <div className="relative h-full w-full" style={transformStyle}>
            <Image
              src={trimmedUrl}
              alt={fileName ? `Arquivo ${fileName}` : "Arquivo"}
              fill
              className="object-contain"
              onError={() => setMode("pdf")}
              unoptimized
            />
          </div>
        ) : canRenderPdf ? (
          <div style={transformStyle}>
            <FileViewerPdf
              fileUrl={trimmedUrl}
              currentPage={currentPage}
              containerWidth={containerWidth}
              onLoadSuccess={(total) => {
                setNumPages(total);
                setCurrentPage(1);
              }}
              onLoadError={() => setMode("error")}
            />
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            intent="secondary"
            size="icon-sm"
            onClick={zoomOut}
            disabled={scale <= MIN_SCALE}
            aria-label="Diminuir zoom"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="min-w-10 text-center text-xs text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            intent="secondary"
            size="icon-sm"
            onClick={zoomIn}
            disabled={scale >= MAX_SCALE}
            aria-label="Aumentar zoom"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        {showPageNav ? (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              intent="secondary"
              size="icon-sm"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={currentPage <= 1}
              aria-label="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-14 text-center text-xs text-muted-foreground">
              {currentPage} / {numPages}
            </span>
            <Button
              type="button"
              intent="secondary"
              size="icon-sm"
              onClick={() =>
                setCurrentPage((prev) => Math.min(numPages, prev + 1))
              }
              disabled={currentPage >= numPages}
              aria-label="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function FileViewer(props: FileViewerProps) {
  return (
    <FileViewerErrorBoundary className={props.className}>
      <FileViewerContent {...props} />
    </FileViewerErrorBoundary>
  );
}
