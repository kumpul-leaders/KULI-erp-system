import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated } from "@/lib/require-role"
import { parseBody } from "@/lib/validations/parse"
import { CreateCommentSchema } from "@/lib/validations/comment"
import { parseMentions } from "@/lib/mentions"
import { createNotifications } from "@/lib/notifications"

// ── GET /api/comments?leadId=<id> | ?clientId=<id> ──────────────────────────
// Returns non-deleted comments for a lead or client, newest first.

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
    const where: Record<string, unknown> = { deletedAt: null }
    if (leadId) where.leadId = leadId
    if (clientId) where.clientId = clientId

    const comments = await prisma.comment.findMany({
      where,
      include: {
        author: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({
      comments: comments.map(serializeComment),
    })
  } catch (err) {
    console.error("[GET /api/comments]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── POST /api/comments ───────────────────────────────────────────────────────
// Creates a comment, parses mentions server-side, auto-follows author + mentioned users.

export async function POST(request: NextRequest) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const parsed = await parseBody(CreateCommentSchema, request)
  if (parsed.error) return parsed.error

  const { body, leadId, clientId } = parsed.data

  try {
    // Parse mentions before transaction to avoid DB round-trips inside tx
    const mentionedUserIds = await parseMentions(body)

    // Collect all user IDs that should become followers
    const followerIds = [...new Set([user.id, ...mentionedUserIds])]

    const comment = await prisma.$transaction(async (tx) => {
      // Create the comment
      const created = await tx.comment.create({
        data: {
          body,
          mentions: mentionedUserIds,
          leadId: leadId ?? null,
          clientId: clientId ?? null,
          authorId: user.id,
        },
        include: {
          author: { select: { id: true, name: true } },
        },
      })

      // Auto-follow: author + mentioned users
      for (const uid of followerIds) {
        if (leadId) {
          await tx.follower.upsert({
            where: { userId_leadId: { userId: uid, leadId } },
            create: { userId: uid, leadId },
            update: {},
          })
        }
        if (clientId) {
          await tx.follower.upsert({
            where: { userId_clientId: { userId: uid, clientId } },
            create: { userId: uid, clientId },
            update: {},
          })
        }
      }

      // Mention notifications — resolve entity name for the title
      if (mentionedUserIds.length > 0) {
        let entityName = ""
        let entityType = ""
        let entityId = ""

        if (leadId) {
          const lead = await tx.lead.findUnique({
            where: { id: leadId },
            select: { client: { select: { name: true } } },
          })
          entityName = lead?.client?.name ?? ""
          entityType = "lead"
          entityId = leadId
        } else if (clientId) {
          const client = await tx.client.findUnique({
            where: { id: clientId },
            select: { name: true },
          })
          entityName = client?.name ?? ""
          entityType = "client"
          entityId = clientId
        }

        await createNotifications(
          mentionedUserIds.map((uid) => ({
            userId: uid,
            type: "mention" as const,
            title: `${created.author.name} menyebut lu di ${entityName}`,
            entityType,
            entityId,
          })),
          user.id, // actorId — skip self-notification
          tx
        )
      }

      return created
    })

    return NextResponse.json({ comment: serializeComment(comment) }, { status: 201 })
  } catch (err) {
    console.error("[POST /api/comments]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── Serializer ───────────────────────────────────────────────────────────────

function serializeComment(comment: {
  id: string
  body: string
  mentions: string[]
  leadId: string | null
  clientId: string | null
  authorId: string
  createdAt: Date
  editedAt: Date | null
  deletedAt: Date | null
  author: { id: string; name: string }
}) {
  return {
    ...comment,
    createdAt: comment.createdAt.toISOString(),
    editedAt: comment.editedAt?.toISOString() ?? null,
    deletedAt: comment.deletedAt?.toISOString() ?? null,
  }
}
