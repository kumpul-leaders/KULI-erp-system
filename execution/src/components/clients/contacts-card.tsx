"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Pencil, Trash2, Star } from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getInitials } from "@/lib/utils"

// ── Types ──────────────────────────────────────────────────────────────────

interface Contact {
  id: string
  name: string
  role: string | null
  email: string | null
  phone: string | null
  isPrimary: boolean
  createdAt: string
}

interface ContactsCardProps {
  clientId: string
  contacts: Contact[]
}

interface ContactFormState {
  name: string
  role: string
  email: string
  phone: string
  isPrimary: boolean
}

const emptyForm: ContactFormState = {
  name: "",
  role: "",
  email: "",
  phone: "",
  isPrimary: false,
}

// ── Component ──────────────────────────────────────────────────────────────

export function ContactsCard({ clientId, contacts }: ContactsCardProps) {
  const router = useRouter()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<Contact | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null)
  const [form, setForm] = useState<ContactFormState>(emptyForm)
  const [errors, setErrors] = useState<Partial<ContactFormState & { email: string }>>({})
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)

  function openAdd() {
    setEditTarget(null)
    setForm(emptyForm)
    setErrors({})
    setSheetOpen(true)
  }

  function openEdit(contact: Contact) {
    setEditTarget(contact)
    setForm({
      name: contact.name,
      role: contact.role ?? "",
      email: contact.email ?? "",
      phone: contact.phone ?? "",
      isPrimary: contact.isPrimary,
    })
    setErrors({})
    setSheetOpen(true)
  }

  function handleField(key: keyof ContactFormState, value: string | boolean) {
    setForm((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: undefined }))
  }

  function validate(): boolean {
    const newErrors: Partial<ContactFormState & { email: string }> = {}
    if (!form.name.trim()) newErrors.name = "Name is required"
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = "Invalid email"
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      const url = editTarget
        ? `/api/contacts/${editTarget.id}`
        : `/api/clients/${clientId}/contacts`
      const method = editTarget ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          role: form.role || null,
          email: form.email || null,
          phone: form.phone || null,
          isPrimary: form.isPrimary,
        }),
      })

      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Operation failed")
      }

      toast.success(editTarget ? "Contact updated" : "Contact added")
      setSheetOpen(false)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/contacts/${deleteTarget.id}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = (await res.json()) as { error?: string }
        throw new Error(data.error ?? "Delete failed")
      }
      toast.success("Contact deleted")
      setDeleteTarget(null)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <div className="rounded-lg border border-neutral-200 bg-white p-5 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-neutral-800">Contacts</h2>
          <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={openAdd}>
            <Plus className="h-3.5 w-3.5" />
            Add Contact
          </Button>
        </div>

        {contacts.length === 0 ? (
          <p className="text-sm text-neutral-400 py-4 text-center">
            No contacts yet. Add the first contact for this client.
          </p>
        ) : (
          <div className="divide-y divide-neutral-100">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 py-3 group"
              >
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="text-xs font-medium bg-accent-100 text-accent-700">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-neutral-800 truncate">
                      {contact.name}
                    </span>
                    {contact.isPrimary && (
                      <Badge className="border-transparent bg-accent-100 text-accent-700 hover:bg-accent-100 text-[10px] px-1.5 py-0">
                        <Star className="h-2.5 w-2.5 mr-0.5" />
                        Primary
                      </Badge>
                    )}
                  </div>
                  {contact.role && (
                    <p className="text-xs text-neutral-500 truncate">{contact.role}</p>
                  )}
                </div>

                <div className="text-xs text-neutral-500 hidden sm:block shrink-0">
                  {contact.email && (
                    <a
                      href={`mailto:${contact.email}`}
                      className="hover:text-accent-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {contact.email}
                    </a>
                  )}
                  {contact.phone && (
                    <span className="ml-3">{contact.phone}</span>
                  )}
                </div>

                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => openEdit(contact)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span className="sr-only">Edit</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-danger-500 hover:text-danger-700 hover:bg-danger-50"
                    onClick={() => setDeleteTarget(contact)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span className="sr-only">Delete</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Sheet */}
      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-[400px] sm:max-w-[400px]">
          <SheetHeader className="mb-6">
            <SheetTitle>{editTarget ? "Edit Contact" : "Add Contact"}</SheetTitle>
          </SheetHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="c-name">
                Name <span className="text-danger-500">*</span>
              </Label>
              <Input
                id="c-name"
                value={form.name}
                onChange={(e) => handleField("name", e.target.value)}
                placeholder="Full name"
              />
              {errors.name && (
                <p className="text-xs text-danger-500">{errors.name}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-role">Role / Title</Label>
              <Input
                id="c-role"
                value={form.role}
                onChange={(e) => handleField("role", e.target.value)}
                placeholder="e.g. Marketing Manager"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-email">Email</Label>
              <Input
                id="c-email"
                type="email"
                value={form.email}
                onChange={(e) => handleField("email", e.target.value)}
                placeholder="email@company.com"
              />
              {errors.email && (
                <p className="text-xs text-danger-500">{errors.email}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-phone">Phone</Label>
              <Input
                id="c-phone"
                value={form.phone}
                onChange={(e) => handleField("phone", e.target.value)}
                placeholder="+62 812 3456 7890"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="c-primary"
                checked={form.isPrimary}
                onChange={(e) => handleField("isPrimary", e.target.checked)}
                className="h-4 w-4 rounded border-input accent-accent-600"
              />
              <Label htmlFor="c-primary" className="cursor-pointer font-normal">
                Set as primary contact
              </Label>
            </div>

            <SheetFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : editTarget ? "Save Changes" : "Add Contact"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Delete Alert */}
      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Delete{" "}
              <span className="font-semibold text-foreground">
                {deleteTarget?.name}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-danger-500 hover:bg-danger-700 text-white"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
