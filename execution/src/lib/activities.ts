import { prisma } from "@/lib/prisma"
import type { PrismaClient } from "@prisma/client"

// PrismaClient transaction type — matches what Prisma passes inside $transaction callback
type PrismaTx = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>

/**
 * Recalculates the denormalized `nextActivityAt` on a Lead.
 *
 * Finds the earliest dueDate among all open activities for the given leadId,
 * then writes it back to Lead.nextActivityAt. If no open activities exist,
 * sets nextActivityAt to null.
 *
 * Call this inside any transaction that creates, completes, cancels, reschedules,
 * or deletes an activity that belongs to a lead.
 *
 * @param leadId  The ID of the lead to recalculate.
 * @param tx      Optional Prisma transaction client. When omitted, runs as a
 *                standalone query against the global prisma instance.
 */
export async function recalcNextActivity(
  leadId: string,
  tx?: PrismaTx
): Promise<void> {
  const db = tx ?? prisma

  // Aggregate: find minimum dueDate of open activities for this lead
  const agg = await db.activity.aggregate({
    where: { leadId, status: "open" },
    _min: { dueDate: true },
  })

  const nextActivityAt = agg._min.dueDate ?? null

  await db.lead.update({
    where: { id: leadId },
    data: { nextActivityAt },
  })
}
