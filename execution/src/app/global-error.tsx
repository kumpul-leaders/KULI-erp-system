"use client"

import { useEffect } from "react"
import { AlertCircle } from "lucide-react"

// global-error.tsx replaces the root layout — must include <html> and <body>.
// Cannot use shadcn components that depend on layout providers here.
// Styling is inline-safe CSS vars that match the design tokens in globals.css.

interface GlobalErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[Global Error]", error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: '"Inter", system-ui, -apple-system, sans-serif',
          background: "#f8fafc",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "100vh",
          padding: "2rem",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "420px",
            background: "#ffffff",
            borderRadius: "0.5rem",
            border: "1px solid #e2e8f0",
            boxShadow:
              "0 1px 3px 0 rgb(0 0 0 / 0.07), 0 1px 2px -1px rgb(0 0 0 / 0.07)",
            padding: "1.5rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.75rem" }}>
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "2.5rem",
                height: "2.5rem",
                flexShrink: 0,
                borderRadius: "9999px",
                background: "#fff1f2",
              }}
            >
              <AlertCircle
                style={{ width: "1.25rem", height: "1.25rem", color: "#ef4444" }}
              />
            </span>
            <h1
              style={{
                margin: 0,
                fontSize: "1rem",
                fontWeight: 600,
                color: "#1e293b",
              }}
            >
              Aplikasi mengalami error
            </h1>
          </div>

          <p
            style={{
              margin: "0 0 0.5rem",
              fontSize: "0.875rem",
              color: "#64748b",
              lineHeight: 1.6,
            }}
          >
            Terjadi kesalahan kritis yang mencegah aplikasi berjalan. Silakan
            coba muat ulang halaman.
          </p>

          {error.digest && (
            <p
              style={{
                margin: "0 0 1rem",
                fontSize: "0.75rem",
                color: "#94a3b8",
                fontFamily: "monospace",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1.25rem" }}>
            <button
              onClick={reset}
              style={{
                padding: "0.375rem 0.875rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#ffffff",
                background: "#6366f1",
                border: "none",
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              Coba lagi
            </button>
            <button
              onClick={() => (window.location.href = "/dashboard")}
              style={{
                padding: "0.375rem 0.875rem",
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "#475569",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "0.375rem",
                cursor: "pointer",
              }}
            >
              Ke Dashboard
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
