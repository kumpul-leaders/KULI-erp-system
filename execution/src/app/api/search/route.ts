import { NextResponse, type NextRequest } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireAuthenticated } from "@/lib/require-role"

// ── GET /api/search?q= ──────────────────────────────────────────────────────
//
// Parallel search across Client, Lead, Contact.
// Limit 5 per entity type. Case-insensitive via Prisma mode:"insensitive".
// Returns: { clients, leads, contacts }

export interface SearchClient {
  id: string
  name: string
  customerCode: string | null
}

export interface SearchLead {
  id: string
  description: string | null
  clientName: string
  stage: string
}

export interface SearchContact {
  id: string
  name: string
  email: string | null
  clientId: string
  clientName: string
}

export interface SearchResponse {
  clients: SearchClient[]
  leads: SearchLead[]
  contacts: SearchContact[]
}

export async function GET(request: NextRequest) {
  const user = await requireAuthenticated()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const q = searchParams.get("q")?.trim() ?? ""

  // Return empty result for queries shorter than 2 characters
  if (q.length < 2) {
    return NextResponse.json<SearchResponse>({
      clients: [],
      leads: [],
      contacts: [],
    })
  }

  const [rawClients, rawLeads, rawContacts] = await Promise.all([
    // Clients: match name or customerCode
    prisma.client.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { customerCode: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, customerCode: true },
      take: 5,
      orderBy: { name: "asc" },
    }),

    // Leads: match description or client name via relation
    prisma.lead.findMany({
      where: {
        OR: [
          { description: { contains: q, mode: "insensitive" } },
          { client: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: {
        id: true,
        description: true,
        stage: true,
        client: { select: { name: true } },
      },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),

    // Contacts: match name or email
    prisma.contact.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        email: true,
        clientId: true,
        client: { select: { name: true } },
      },
      take: 5,
      orderBy: { name: "asc" },
    }),
  ])

  const response: SearchResponse = {
    clients: rawClients.map((c) => ({
      id: c.id,
      name: c.name,
      customerCode: c.customerCode,
    })),
    leads: rawLeads.map((l) => ({
      id: l.id,
      description: l.description,
      clientName: l.client.name,
      stage: l.stage,
    })),
    contacts: rawContacts.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      clientId: c.clientId,
      clientName: c.client.name,
    })),
  }

  return NextResponse.json<SearchResponse>(response)
}
