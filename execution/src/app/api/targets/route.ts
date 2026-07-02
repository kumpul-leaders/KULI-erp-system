import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated, requireAdminOrDirector } from "@/lib/require-role"
import { $Enums } from "@prisma/client"
import { parseBody } from "@/lib/validations/parse"
import { CreateTargetSchema } from "@/lib/validations/target"

// ── Serializer ──────────────────────────────────────────────────────────────

function serializeTarget(target: {
  id: string
  periodMonth: number
  periodYear: number
  revenueTarget: { toNumber?: () => number } | null
  newClientTarget: number
  type: $Enums.TargetType
  salesId: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: target.id,
    periodMonth: target.periodMonth,
    periodYear: target.periodYear,
    revenueTarget: target.revenueTarget ? Number(target.revenueTarget) : 0,
    newClientTarget: target.newClientTarget,
    type: target.type,
    salesId: target.salesId,
    createdAt: target.createdAt.toISOString(),
    updatedAt: target.updatedAt.toISOString(),
  }
}

// ── GET /api/targets ─────────────────────────────────────────────────────────
// Query params:
//   aeId — if provided, returns targets for that AE + company-wide targets
//           if omitted, returns all targets

export async function GET(request: NextRequest) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const aeId = searchParams.get("aeId")

  try {
    let targets

    if (aeId) {
      targets = await prisma.target.findMany({
        where: {
          OR: [
            { salesId: aeId },
            { salesId: null },
          ],
        },
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      })
    } else {
      targets = await prisma.target.findMany({
        orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      })
    }

    return NextResponse.json({ targets: targets.map(serializeTarget) })
  } catch (err) {
    console.error("[GET /api/targets]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// ── POST /api/targets (upsert) ───────────────────────────────────────────────
// Body:
//   periodMonth     number   — 1-12 (monthly) or 1-4 (quarterly)
//   periodYear      number
//   revenueTarget   number
//   newClientTarget number   (optional, default 0)
//   type            "monthly" | "quarterly"
//   salesId         string | null (optional, default null = company-wide)

export async function POST(request: NextRequest) {
  const user = await requireAdminOrDirector()
  if (!user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const parsed = await parseBody(CreateTargetSchema, request)
  if (parsed.error) return parsed.error

  const body = parsed.data

  const salesId: string | null =
    typeof body.salesId === "string" && body.salesId.length > 0 ? body.salesId : null

  const periodMonth = body.periodMonth
  const periodYear = body.periodYear
  const revenueTarget = body.revenueTarget
  const newClientTarget =
    typeof body.newClientTarget === "number" && body.newClientTarget >= 0
      ? body.newClientTarget
      : 0
  const type = body.type

  try {
    let target

    if (salesId !== null) {
      target = await prisma.target.upsert({
        where: {
          periodMonth_periodYear_type_salesId: {
            periodMonth,
            periodYear,
            type,
            salesId,
          },
        },
        update: { revenueTarget, newClientTarget },
        create: { periodMonth, periodYear, revenueTarget, newClientTarget, type, salesId },
      })
    } else {
      // Company-wide target: salesId = null
      const existing = await prisma.target.findFirst({
        where: { periodMonth, periodYear, type, salesId: null },
      })

      if (existing) {
        target = await prisma.target.update({
          where: { id: existing.id },
          data: { revenueTarget, newClientTarget },
        })
      } else {
        target = await prisma.target.create({
          data: { periodMonth, periodYear, revenueTarget, newClientTarget, type, salesId: null },
        })
      }
    }

    return NextResponse.json({ target: serializeTarget(target) }, { status: 200 })
  } catch (err) {
    console.error("[POST /api/targets]", err)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
