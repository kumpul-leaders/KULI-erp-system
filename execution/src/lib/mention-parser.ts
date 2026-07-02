// ── Mention format ─────────────────────────────────────────────────────────
// @[Display Name](userId)  — markdown-lite inline mention
// Example: "Hey @[Alice](550e8400-e29b-41d4-a716-446655440000) please review"

const MENTION_REGEX = /@\[([^\]]+)\]\(([^)]+)\)/g

/**
 * Pure function — no DB access, no imports.
 * Extracts raw userId strings from all @[Name](userId) tokens in body.
 * Duplicates are preserved; caller deduplicates if needed.
 */
export function extractMentionIds(body: string): string[] {
  const ids: string[] = []
  let match: RegExpExecArray | null
  // Clone regex to reset state — avoid shared /g lastIndex issues
  const re = new RegExp(MENTION_REGEX.source, MENTION_REGEX.flags)
  while ((match = re.exec(body)) !== null) {
    ids.push(match[2])
  }
  return ids
}
