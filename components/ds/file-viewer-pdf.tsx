"use client";

import * as React from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Spinner } from "@/components/ui/spinner";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

type FileViewerPdfProps = {
  fileUrl: string;
  currentPage: number;
  containerWidth: number;
  onLoadSuccess: (numPages: number) => void;
  onLoadError: () => void;
};

export default function FileViewerPdf({
  fileUrl,
  currentPage,
  containerWidth,
  onLoadSuccess,
  onLoadError,
}: FileViewerPdfProps) {
  return (
    <Document
      file={fileUrl}
      onLoadSuccess={({ numPages }) => onLoadSuccess(numPages)}
      onLoadError={onLoadError}
      loading={
        <div className="flex items-center justify-center p-6">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      }
    >
      <Page
        pageNumber={currentPage}
        width={containerWidth > 0 ? containerWidth : undefined}
        renderAnnotationLayer={false}
        renderTextLayer={false}
      />
    </Document>
  );
}
