"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Pencil, Check, X } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { getInitials } from "@/lib/utils"

interface AeOption {
  id: string
  name: string
}

interface AeCardProps {
  clientId: string
  ae: { id: string; name: string } | null
  aeOptions: AeOption[]
}

export function AeCard({ clientId, ae, aeOptions }: AeCardProps) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [selectedAe, setSelectedAe] = useState(ae?.id ?? "none")
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${clientId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          primaryAe: selectedAe && selectedAe !== "none" ? selectedAe : null,
        }),
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Failed to update AE")
      }
      toast.success("AE updated")
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold text-neutral-800">Busdev/AE Assigned</h2>
        {!editing ? (
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => {
              setSelectedAe(ae?.id ?? "none")
              setEditing(true)
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
            <span className="sr-only">Edit AE</span>
          </Button>
        ) : (
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => setEditing(false)}
              disabled={saving}
            >
              <X className="h-3.5 w-3.5" />
              <span className="sr-only">Cancel</span>
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-accent-600"
              onClick={handleSave}
              disabled={saving}
            >
              <Check className="h-3.5 w-3.5" />
              <span className="sr-only">Save</span>
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <Select value={selectedAe} onValueChange={setSelectedAe}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select AE" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No AE assigned</SelectItem>
            {aeOptions.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : ae ? (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs font-medium bg-accent-100 text-accent-700">
              {getInitials(ae.name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium text-neutral-800">{ae.name}</span>
        </div>
      ) : (
        <p className="text-sm text-neutral-400">No AE assigned</p>
      )}
    </div>
  )
}
