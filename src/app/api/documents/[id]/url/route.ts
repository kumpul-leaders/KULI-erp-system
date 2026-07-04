import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated } from "@/lib/require-role"
import { createAdminClient } from "@/lib/supabase/admin-client"

// ── Helpers ─────────────────────────────────────────────────────────────────

const BUCKET = "pipeline-docs"

/**
 * Extract a storage path from either:
 * - New format: "leads/abc123/quotation-1234567890.pdf"  (path only)
 * - Legacy format: "https://....supabase.co/storage/v1/object/public/pipeline-docs/leads/abc123/..."
 */
function extractStoragePath(fileUrl: string): string {
  if (!fileUrl.startsWith("http")) {
    // Already a clean path
    return fileUrl
  }
  // Parse the URL and strip the known prefix segments:
  // /storage/v1/object/public/pipeline-docs/<path>
  // or /storage/v1/object/sign/pipeline-docs/<path>
  const url = new URL(fileUrl)
  const prefix = `/storage/v1/object/public/${BUCKET}/`
  const signPrefix = `/storage/v1/object/sign/${BUCKET}/`

  if (url.pathname.startsWith(prefix)) {
    return url.pathname.slice(prefix.length)
  }
  if (url.pathname.startsWith(signPrefix)) {
    return url.pathname.slice(signPrefix.length)
  }

  // Fallback: try to find bucket name in the path
  const bucketMarker = `/${BUCKET}/`
  const idx = url.pathname.indexOf(bucketMarker)
  if (idx !== -1) {
    return url.pathname.slice(idx + bucketMarker.length)
  }

  // Last resort: treat the whole value as a path (might fail at storage layer)
  return fileUrl
}

// ── GET /api/documents/[id]/url ─────────────────────────────────────────────
// Returns a short-lived (5-minute) signed URL for a PipelineDocument.
// Requires any authenticated session.
// Query param: none required. The document ID is the route param.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await requireAuthenticated()
  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const document = await prisma.pipelineDocument.findUnique({
    where: { id },
    select: { id: true, fileUrl: true, leadId: true },
  })

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const storagePath = extractStoragePath(document.fileUrl)

  const adminClient = createAdminClient()
  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, 300) // 5 minutes

  if (error || !data?.signedUrl) {
    console.error("[createSignedUrl error]", error)
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 }
    )
  }

  return NextResponse.json({ url: data.signedUrl })
}
