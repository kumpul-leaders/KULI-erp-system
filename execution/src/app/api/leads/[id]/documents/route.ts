import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireCanCreateLeads } from "@/lib/require-role"
import { createAdminClient } from "@/lib/supabase/admin-client"
import type { DocumentType } from "@/types"

// ── Validation ──────────────────────────────────────────────────────────────

const DOCUMENT_TYPES: DocumentType[] = [
  "quotation",
  "quotation_signed",
  "contract",
  "other",
]

function isDocumentType(v: unknown): v is DocumentType {
  return typeof v === "string" && DOCUMENT_TYPES.includes(v as DocumentType)
}

// ── POST /api/leads/[id]/documents ──────────────────────────────────────────
// Upload a PDF to Supabase Storage (private bucket, service-role key).
// Stores the storage path — NOT a public URL — in the database.
// Signed URLs are generated on-demand via GET /api/documents/[id]/url.
//
// Auth: Admin / Commercial Director / Account Manager / Account (own leads only)
// Body: FormData { file: File, type: DocumentType }

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await requireCanCreateLeads()
  if (!authUser) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { id } = await params

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 })
  }

  const file = formData.get("file")
  const type = formData.get("type")

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file is required" }, { status: 400 })
  }
  if (!isDocumentType(type)) {
    return NextResponse.json(
      { error: "Valid document type is required" },
      { status: 400 }
    )
  }

  // Validate file type
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are accepted" },
      { status: 400 }
    )
  }

  // Validate file size (max 20MB)
  const MAX_SIZE_BYTES = 20 * 1024 * 1024
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File size must not exceed 20MB" },
      { status: 400 }
    )
  }

  try {
    const lead = await prisma.lead.findUnique({ where: { id } })
    if (!lead) {
      return NextResponse.json({ error: "Lead not found" }, { status: 404 })
    }

    // Ownership check for account role
    if (authUser.role === "account" && lead.salesId !== authUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Upload to Supabase Storage via service-role key (private bucket)
    const timestamp = Date.now()
    const storagePath = `leads/${id}/${type}-${timestamp}.pdf`

    const adminClient = createAdminClient()
    const fileBuffer = await file.arrayBuffer()

    const { error: uploadError } = await adminClient.storage
      .from("pipeline-docs")
      .upload(storagePath, fileBuffer, {
        contentType: "application/pdf",
        upsert: false,
      })

    if (uploadError) {
      console.error("[Storage upload error]", uploadError)
      return NextResponse.json(
        { error: `Storage upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Store the storage path (not a public URL) — signed URLs are generated
    // on-demand via GET /api/documents/[id]/url
    const document = await prisma.pipelineDocument.create({
      data: {
        leadId: id,
        type,
        fileUrl: storagePath,
        fileName: file.name,
        uploadedBy: authUser.id,
      },
      include: {
        uploader: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json(
      {
        document: {
          ...document,
          uploadedAt: document.uploadedAt.toISOString(),
          createdAt: document.createdAt.toISOString(),
        },
      },
      { status: 201 }
    )
  } catch (err) {
    console.error("[POST /api/leads/[id]/documents]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
