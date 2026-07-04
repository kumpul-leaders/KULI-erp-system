import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

type ParseResult<T> =
  | { data: T; error?: never }
  | { data?: never; error: NextResponse }

/**
 * Parses the JSON body of a NextRequest against a Zod schema.
 *
 * On success:  returns { data: T }
 * On failure:  returns { error: NextResponse 400 } with a clear per-field message.
 *
 * Error format mirrors existing API route pattern:
 *   { "error": "field: message; field2: message2" }
 */
export async function parseBody<T>(
  schema: z.ZodType<T>,
  request: NextRequest
): Promise<ParseResult<T>> {
  let raw: unknown

  try {
    raw = await request.json()
  } catch {
    return {
      error: NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
    }
  }

  const result = schema.safeParse(raw)

  if (!result.success) {
    const issues = result.error.issues
    const message = issues
      .map((issue) => {
        const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : ""
        return `${path}${issue.message}`
      })
      .join("; ")

    return {
      error: NextResponse.json({ error: message }, { status: 400 }),
    }
  }

  return { data: result.data }
}
