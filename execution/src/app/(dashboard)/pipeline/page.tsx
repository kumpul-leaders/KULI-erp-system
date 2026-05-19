import type { Metadata } from "next"
import { Suspense } from "react"
import { Topbar } from "@/components/layout/topbar"
import { Skeleton } from "@/components/ui/skeleton"
import { PipelineKanbanLoader } from "@/components/pipeline/pipeline-kanban-loader"

export const metadata: Metadata = {
  title: "Pipeline",
}

// ── Skeleton for kanban while loading ────────────────────────────────────────

function KanbanSkeleton() {
  return (
    <div className="flex gap-3 overflow-x-auto pb-6">
      {Array.from({ length: 7 }).map((_, ci) => (
        <div
          key={ci}
          className="flex w-[280px] flex-shrink-0 flex-col rounded-lg bg-neutral-50"
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-neutral-200">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-4" />
          </div>
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: ci < 2 ? 3 : ci === 2 ? 2 : 1 }).map(
              (_, ri) => (
                <div
                  key={ri}
                  className="rounded-lg border border-neutral-200 bg-white p-4 shadow-kanban"
                >
                  <Skeleton className="h-4 w-3/4 mb-1" />
                  <Skeleton className="h-3 w-1/3 mb-3" />
                  <Skeleton className="h-5 w-24 mb-3 rounded-sm" />
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-12" />
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function PipelinePage() {
  return (
    <>
      <Topbar title="Pipeline" />
      <main className="flex-1 overflow-hidden px-8 py-6 flex flex-col">
        {/* Suspense required: PipelineKanbanLoader uses useSearchParams() */}
        <Suspense fallback={<KanbanSkeleton />}>
          <PipelineKanbanLoader />
        </Suspense>
      </main>
    </>
  )
}
