import { NextResponse, type NextRequest } from "next/server"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireAdminOrDirector } from "@/lib/require-role"

// ── Allowlist ────────────────────────────────────────────────────────────────

const ALLOWED_KEYS = ["stage_gates", "product_line_labels"] as const
type AllowedKey = (typeof ALLOWED_KEYS)[number]

function isAllowedKey(v: unknown): v is AllowedKey {
  return typeof v === "string" && (ALLOWED_KEYS as readonly string[]).includes(v)
}

// ── PATCH /api/system-config/[key] ───────────────────────────────────────────
// Upserts a single system config key. Admin or Commercial Director only.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const user = await requireAdminOrDirector()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { key } = await params

  if (!isAllowedKey(key)) {
    return NextResponse.json(
      { error: `Invalid key. Must be one of: ${ALLOWED_KEYS.join(", ")}` },
      { status: 400 }
    )
  }

  let body: { value: unknown }
  try {
    body = (await request.json()) as { value: unknown }
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  if (!("value" in body)) {
    return NextResponse.json({ error: "Body must contain a 'value' field" }, { status: 400 })
  }

  try {
    const jsonValue = body.value as Prisma.InputJsonValue
    await prisma.systemConfig.upsert({
      where: { key },
      update: { value: jsonValue },
      create: { key, value: jsonValue },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[PATCH /api/system-config/[key]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
