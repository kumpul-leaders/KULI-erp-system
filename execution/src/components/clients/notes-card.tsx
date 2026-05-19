"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil, Check, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface NotesCardProps {
  clientId: string
  notes: string | null
}

export function NotesCard({ clientId, notes: initialNotes }: NotesCardProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialNotes ?? "")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value || null }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to save notes")
      }
      toast.success("Notes saved")
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setValue(initialNotes ?? "")
    setEditing(false)
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-neutral-800">Notes</h2>
        {!editing && (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Edit notes</span>
          </Button>
        )}
      </div>

      {editing ? (
        <div className="space-y-3">
          <Textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={5}
            placeholder="Add internal notes about this client..."
            autoFocus
            className="resize-none"
          />
          <div className="flex gap-2 justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
              className="gap-1.5 h-8"
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5 h-8"
            >
              <Check className="h-3.5 w-3.5" />
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className="text-sm text-neutral-600 whitespace-pre-wrap min-h-[60px] cursor-pointer rounded-md p-2 -m-2 hover:bg-neutral-50 transition-colors"
          onClick={() => setEditing(true)}
        >
          {initialNotes ? (
            initialNotes
          ) : (
            <span className="text-neutral-400 italic">
              No notes. Click to add...
            </span>
          )}
        </div>
      )}
    </div>
  )
}
