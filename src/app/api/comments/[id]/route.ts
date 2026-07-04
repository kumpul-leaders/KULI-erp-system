import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated } from "@/lib/require-role"
import { parseBody } from "@/lib/validations/parse"
import { UpdateCommentSchema } from "@/lib/validations/comment"
import { parseMentions } from "@/lib/mentions"
import { createNotifications } from "@/lib/notifications"

// ── PATCH /api/comments/[id] ─────────────────────────────────────────────────
// Edits body, sets editedAt, re-parses mentions. Author only.

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.comment.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 })
  }
  if (existing.authorId !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = await parseBody(UpdateCommentSchema, request)
  if (parsed.error) return parsed.error

  const { body } = parsed.data

  try {
    const mentionedUserIds = await parseMentions(body)

    // Newly mentioned users = current mentions minus previous mentions
    const prevMentions = new Set(existing.mentions as string[])
    const newlyMentioned = mentionedUserIds.filter((uid) => !prevMentions.has(uid))

    const updated = await prisma.$transaction(async (tx) => {
      // Auto-follow newly mentioned users
      for (const uid of mentionedUserIds) {
        if (existing.leadId) {
          await tx.follower.upsert({
            where: { userId_leadId: { userId: uid, leadId: existing.leadId } },
            create: { userId: uid, leadId: existing.leadId },
            update: {},
          })
        }
        if (existing.clientId) {
          await tx.follower.upsert({
            where: { userId_clientId: { userId: uid, clientId: existing.clientId } },
            create: { userId: uid, clientId: existing.clientId },
            update: {},
          })
        }
      }

      const result = await tx.comment.update({
        where: { id },
        data: {
          body,
          mentions: mentionedUserIds,
          editedAt: new Date(),
        },
        include: {
          author: { select: { id: true, name: true } },
        },
      })

      // Mention notifications — only for newly added mentions (anti-noise)
      if (newlyMentioned.length > 0) {
        let entityName = ""
        let entityType = ""
        let entityId = ""

        if (existing.leadId) {
          const lead = await tx.lead.findUnique({
            where: { id: existing.leadId },
            select: { client: { select: { name: true } } },
          })
          entityName = lead?.client?.name ?? ""
          entityType = "lead"
          entityId = existing.leadId
        } else if (existing.clientId) {
          const client = await tx.client.findUnique({
            where: { id: existing.clientId },
            select: { name: true },
          })
          entityName = client?.name ?? ""
          entityType = "client"
          entityId = existing.clientId
        }

        await createNotifications(
          newlyMentioned.map((uid) => ({
            userId: uid,
            type: "mention" as const,
            title: `${result.author.name} menyebut lu di ${entityName}`,
            entityType,
            entityId,
          })),
          user.id,
          tx
        )
      }

      return result
    })

    return NextResponse.json({ comment: serializeComment(updated) })
  } catch (err) {
    console.error("[PATCH /api/comments/[id]]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── DELETE /api/comments/[id] ─────────────────────────────────────────────────
// Soft delete. Author or admin.

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params

  const existing = await prisma.comment.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) {
    return NextResponse.json({ error: "Comment not found" }, { status: 404 })
  }

  const isAuthor = existing.authorId === user.id
  const isAdmin = user.role === "admin"

  if (!isAuthor && !isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    await prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("[DELETE /api/comments/[id]]", err)
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
