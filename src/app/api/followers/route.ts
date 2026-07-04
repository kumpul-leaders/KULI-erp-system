import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated } from "@/lib/require-role"

// ── GET /api/followers?leadId=<id> | ?clientId=<id> ─────────────────────────
// Returns all followers for a lead or client, including user {id, name}.

export async function GET(request: NextRequest) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get("leadId")
  const clientId = searchParams.get("clientId")

  if (!leadId && !clientId) {
    return NextResponse.json(
      { error: "leadId or clientId query parameter is required" },
      { status: 400 }
    )
  }

  try {
    const where: Record<string, unknown> = {}
    if (leadId) where.leadId = leadId
    if (clientId) where.clientId = clientId

    const followers = await prisma.follower.findMany({
      where,
      include: {
        user: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    })

    return NextResponse.json({
      followers: followers.map(serializeFollower),
    })
  } catch (err) {
    console.error("[GET /api/followers]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── POST /api/followers ───────────────────────────────────────────────────────
// Authenticated user follows themselves on a lead or client (upsert — idempotent).
// Body: { leadId?: string, clientId?: string }

export async function POST(request: NextRequest) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const body = raw as Record<string, unknown>
  const leadId = typeof body.leadId === "string" ? body.leadId : null
  const clientId = typeof body.clientId === "string" ? body.clientId : null

  if (!leadId && !clientId) {
    return NextResponse.json(
      { error: "leadId or clientId is required" },
      { status: 400 }
    )
  }

  try {
    let follower

    if (leadId) {
      follower = await prisma.follower.upsert({
        where: { userId_leadId: { userId: user.id, leadId } },
        create: { userId: user.id, leadId },
        update: {},
        include: { user: { select: { id: true, name: true } } },
      })
    } else if (clientId) {
      follower = await prisma.follower.upsert({
        where: { userId_clientId: { userId: user.id, clientId } },
        create: { userId: user.id, clientId },
        update: {},
        include: { user: { select: { id: true, name: true } } },
      })
    }

    return NextResponse.json({ follower: serializeFollower(follower!) }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/followers]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── DELETE /api/followers ─────────────────────────────────────────────────────
// Authenticated user unfollows themselves.
// Body: { leadId?: string, clientId?: string }

export async function DELETE(request: NextRequest) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const body = raw as Record<string, unknown>
  const leadId = typeof body.leadId === "string" ? body.leadId : null
  const clientId = typeof body.clientId === "string" ? body.clientId : null

  if (!leadId && !clientId) {
    return NextResponse.json(
      { error: "leadId or clientId is required" },
      { status: 400 }
    )
  }

  try {
    if (leadId) {
      await prisma.follower.deleteMany({
        where: { userId: user.id, leadId },
      })
    } else if (clientId) {
      await prisma.follower.deleteMany({
        where: { userId: user.id, clientId },
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/followers]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── Serializer ───────────────────────────────────────────────────────────────

function serializeFollower(follower: {
  id: string
  userId: string
  leadId: string | null
  clientId: string | null
  createdAt: Date
  user: { id: string; name: string }
}) {
  return {
    ...follower,
    createdAt: follower.createdAt.toISOString(),
  }
}
