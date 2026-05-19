"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { toast } from "sonner"
import { Upload, FileText, Loader2, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import type { DocumentType } from "@/types"

interface UploadedDoc {
  id: string
  type: string
  fileUrl: string
  fileName: string | null
  uploadedAt: string
}

interface DocumentUploadZoneProps {
  leadId: string
  type: DocumentType
  label: string
  existingDocs: UploadedDoc[]
  onUploadSuccess: (doc: UploadedDoc) => void
}

export function DocumentUploadZone({
  leadId,
  type,
  label,
  existingDocs,
  onUploadSuccess,
}: DocumentUploadZoneProps) {
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (!file) return

      setUploading(true)
      try {
        const formData = new FormData()
        formData.append("file", file)
        formData.append("type", type)

        const res = await fetch(`/api/leads/${leadId}/documents`, {
          method: "POST",
          body: formData,
        })

        if (!res.ok) {
          const data = (await res.json()) as { error?: string }
          throw new Error(data.error ?? "Upload failed")
        }

        const data = (await res.json()) as { document: UploadedDoc }
        toast.success(`${label} uploaded successfully`)
        onUploadSuccess(data.document)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Upload failed")
      } finally {
        setUploading(false)
      }
    },
    [leadId, type, label, onUploadSuccess]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => void onDrop(files),
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: uploading,
  })

  const latestDoc = existingDocs.length > 0 ? existingDocs[0] : null

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-neutral-600 uppercase tracking-wide">
        {label}
      </p>

      {/* Current uploaded doc */}
      {latestDoc && (
        <div className="flex items-center gap-2 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
          <FileText className="h-4 w-4 text-neutral-400 flex-shrink-0" />
          <span className="text-xs text-neutral-700 truncate flex-1">
            {latestDoc.fileName ?? "document.pdf"}
          </span>
          <a
            href={latestDoc.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-600 hover:text-accent-700"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}

      {/* Drop zone */}
      <div
        {...getRootProps()}
        className={cn(
          "flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors cursor-pointer",
          isDragActive
            ? "border-accent-400 bg-accent-50"
            : "border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        <input {...getInputProps()} />
        {uploading ? (
          <Loader2 className="h-5 w-5 text-neutral-400 animate-spin mb-1.5" />
        ) : (
          <Upload className="h-5 w-5 text-neutral-400 mb-1.5" />
        )}
        <p className="text-xs text-neutral-500">
          {uploading
            ? "Uploading..."
            : isDragActive
            ? "Drop PDF here"
            : latestDoc
            ? "Upload new version"
            : "Drop PDF or click to browse"}
        </p>
        <p className="text-xs text-neutral-400 mt-0.5">Max 20MB</p>
      </div>
    </div>
  )
}
