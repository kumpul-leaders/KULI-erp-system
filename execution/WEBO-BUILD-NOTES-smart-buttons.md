# WEBO Build Notes — Smart Buttons (Phase 1)

**Date:** 2026-07-02
**Build result:** `npx tsc --noEmit` — 0 errors. `npm run build` — clean.

---

## Files Changed

| File | Change |
|------|--------|
| `src/components/shared/smart-buttons.tsx` | NEW — reusable SmartButtons component |
| `src/components/pipeline/lead-detail-client.tsx` | Added SmartButtons row + section IDs on Documents and Stage History sections |
| `src/app/(dashboard)/clients/[id]/page.tsx` | Added SmartButtons row + section IDs on Contacts and Upsells sections |

---

## Key Decisions

### Filter by client on /pipeline
The pipeline filter URL param (`filter`) encodes a `FilterCondition[]` array as base64 JSON. The `pipelineFieldConfigs` in `pipeline-kanban-loader.tsx` supports these fields: `clientName` (text), `stage`, `productLine`, `projectType`, `salesId`, `projectedRevenue`, `actualRevenue`, `quarter`, `billingPlan`.

`clientId` is NOT in the field config list. There is no URL mechanism to filter pipeline by a specific client ID. Decision: "N Leads" button on client detail links to `/pipeline` without a filter. User can search by client name using the search input. This was the specified fallback in the task brief.

### "use client" on SmartButtons
SmartButtons needs `"use client"` because scroll-to-section buttons use `onClick` + `scrollIntoView`. This is correct — browser API usage. The component is used as a leaf in both a Server Component (clients/[id]/page.tsx) and a Client Component (lead-detail-client.tsx) — both are valid RSC usage patterns.

### Section ID wrapping
Sections that don't have their own wrapper div (DocumentsCard, ContactsCard, UpsellsCard) were wrapped in a `<div id="section-...">` to provide the scroll target anchor. This is the minimal change — no DOM restructuring.

### Smart button variant for "Sales" and "Cumulative Value"
- Sales (lead detail): rendered as `type: "badge"` (non-interactive) since navigating to a user record is not meaningful in this app context.
- Cumulative Value (client detail): rendered as `type: "badge"` only when `cumulativeValue > 0` — no badge shown if zero.

### Counts sourced from existing data
All counts come from data already fetched by the server page — no additional Prisma queries were needed:
- Lead detail: `lead.documents.length`, `lead.stageHistory.length` (already in `fetchLead` include)
- Client detail: `client.contacts.length`, `client.upsellOpportunities.length`, `serializedLeads.length` (already fetched)

### No `_count` addition needed
The task specified to add `_count` to queries if counts weren't already available. All required counts are available via the existing `include` arrays — full relation arrays are fetched, `.length` is used directly. Adding `_count` would be premature optimization here.
