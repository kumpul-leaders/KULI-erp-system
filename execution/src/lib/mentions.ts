import { prisma } from "@/lib/prisma"
import { extractMentionIds } from "@/lib/mention-parser"

// Re-export so callers can use a single import path for both functions
export { extractMentionIds } from "@/lib/mention-parser"

/**
 * Async — validates extracted IDs against the database.
 * Returns deduplicated array of valid, active user IDs only.
 */
export async function parseMentions(body: string): Promise<string[]> {
  const rawIds = extractMentionIds(body)
  if (rawIds.length === 0) return []

  const unique = [...new Set(rawIds)]

  const validUsers = await prisma.user.findMany({
    where: {
      id: { in: unique },
      isActive: true,
    },
    select: { id: true },
  })

  return validUsers.map((u) => u.id)
}
