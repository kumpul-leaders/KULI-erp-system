"use client"

import { useEffect } from "react"
import { AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    // Log to console so we can debug in dev
    console.error("[Dashboard Error]", error)
  }, [error])

  return (
    <div className="flex flex-1 items-center justify-center px-8 py-16">
      <Card className="w-full max-w-md border-neutral-200 shadow-card">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-danger-50">
              <AlertCircle className="h-5 w-5 text-danger-500" />
            </span>
            <CardTitle className="text-base font-semibold text-neutral-800">
              Terjadi Kesalahan
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-neutral-500">
            Halaman ini mengalami error yang tidak terduga. Tim teknis sudah
            diberitahu secara otomatis.
          </p>
          {error.digest && (
            <p className="mt-2 text-xs text-neutral-400 font-mono">
              Error ID: {error.digest}
            </p>
          )}
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button onClick={reset} size="sm">
            Coba lagi
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => (window.location.href = "/dashboard")}
          >
            Ke Dashboard
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
