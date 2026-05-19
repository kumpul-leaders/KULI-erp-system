"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// /pipeline/new redirects to /pipeline with the sheet open.
// The PipelineKanbanLoader reads the ?new=1 param and auto-opens the sheet.
// This keeps the create flow URL-addressable for bookmarking / direct linking.

export default function PipelineNewPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace("/pipeline?new=1")
  }, [router])

  return null
}
