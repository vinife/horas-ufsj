"use client";

import * as React from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

type FileViewerErrorBoundaryProps = {
  children: React.ReactNode;
  className?: string;
};

type FileViewerErrorBoundaryState = {
  hasError: boolean;
};

/**
 * Catches any render-time exception from the file viewer (e.g. an
 * unconfigured next/image host, or an unexpected react-pdf failure) so a
 * broken/unexpected file never crashes the surrounding dialog or page —
 * falls back to the same empty-state look the viewer already uses for a
 * file that simply failed to load.
 */
export class FileViewerErrorBoundary extends React.Component<
  FileViewerErrorBoundaryProps,
  FileViewerErrorBoundaryState
> {
  state: FileViewerErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): FileViewerErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[FileViewer] Falha ao renderizar o arquivo:", error);
  }

  componentDidUpdate(prevProps: FileViewerErrorBoundaryProps) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className={cn(
            "flex h-full w-full min-h-0 flex-col items-center justify-center gap-3 rounded-lg border bg-muted/20 p-6 text-center text-muted-foreground",
            this.props.className,
          )}
        >
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
      );
    }

    return this.props.children;
  }
}
