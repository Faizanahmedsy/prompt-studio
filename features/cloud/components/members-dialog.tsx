"use client"

import { Loader2, Mail, Trash2, UserPlus } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { TextField } from "@/components/shared/form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { isApiError } from "@/lib/api/client"
import * as projectsApi from "@/lib/api/projects"
import type { MemberRead, ProjectRole } from "@/lib/api/types"
import { useAuthStore } from "@/stores/use-auth-store"

const ROLES: { value: ProjectRole; label: string; hint: string }[] = [
  { value: "OWNER", label: "Owner", hint: "Can invite, change roles and delete" },
  { value: "EDITOR", label: "Editor", hint: "Can edit the diagram" },
  { value: "COMMENTER", label: "Commenter", hint: "Can read and comment" },
  { value: "VIEWER", label: "Viewer", hint: "Can read" },
]

/**
 * Sharing, which in this product means one thing: adding an email address.
 *
 * The address does not need an account — the invitation waits for it and is
 * claimed when someone registers with it. That is worth saying on screen,
 * because "invite by email" usually means "they must already be a user".
 */
export function MembersDialog({
  remoteId,
  projectName,
  open,
  onOpenChange,
}: {
  remoteId: string | null
  projectName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const me = useAuthStore((s) => s.user)
  const [members, setMembers] = useState<MemberRead[]>([])
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<ProjectRole>("EDITOR")
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)

  const iAmOwner = members.some((member) => member.user?.id === me?.id && member.role === "OWNER")

  useEffect(() => {
    if (!open || !remoteId) return
    setLoading(true)
    projectsApi
      .listMembers(remoteId)
      .then(setMembers)
      .catch((failure) =>
        toast.error(isApiError(failure) ? failure.message : "Could not load the member list")
      )
      .finally(() => setLoading(false))
  }, [open, remoteId])

  async function invite(event: React.FormEvent) {
    event.preventDefault()
    if (!remoteId) return
    setBusy(true)
    try {
      const added = await projectsApi.addMember(remoteId, { email, role })
      setMembers((current) => [...current, added])
      setEmail("")
      toast.success(
        added.status === "INVITED"
          ? `Invitation sent to ${added.email}`
          : `${added.email} now has access`
      )
    } catch (failure) {
      toast.error(isApiError(failure) ? failure.message : "Could not add that address")
    } finally {
      setBusy(false)
    }
  }

  async function changeRole(member: MemberRead, next: ProjectRole) {
    if (!remoteId) return
    try {
      const updated = await projectsApi.updateMember(remoteId, member.id, { role: next })
      setMembers((current) => current.map((row) => (row.id === member.id ? updated : row)))
    } catch (failure) {
      toast.error(isApiError(failure) ? failure.message : "Could not change that role")
    }
  }

  async function remove(member: MemberRead) {
    if (!remoteId) return
    try {
      await projectsApi.removeMember(remoteId, member.id)
      setMembers((current) => current.filter((row) => row.id !== member.id))
      toast.success(`${member.email} removed`)
    } catch (failure) {
      toast.error(isApiError(failure) ? failure.message : "Could not remove that person")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Share “{projectName}”</DialogTitle>
          <DialogDescription>
            Only the addresses on this list can open the project. They do not need an account
            yet — an invitation waits until they create one.
          </DialogDescription>
        </DialogHeader>

        {!remoteId ? (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            This project has not reached your account yet. It will sync in a moment — sharing
            becomes available once it has.
          </p>
        ) : (
          <>
            {iAmOwner && (
              <form onSubmit={invite} className="flex items-end gap-2">
                <TextField
                  label="Email address"
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  className="flex-1"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <Select value={role} onValueChange={(value) => setRole(value as ProjectRole)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button type="submit" disabled={busy || !email}>
                  {busy ? <Loader2 className="animate-spin" /> : <UserPlus />}
                  Add
                </Button>
              </form>
            )}

            <div className="mt-2 flex flex-col divide-y divide-border rounded-lg border border-border">
              {loading && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">Loading…</p>
              )}
              {!loading && !members.length && (
                <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                  Nobody else yet.
                </p>
              )}
              {members.map((member) => (
                <div key={member.id} className="flex items-center gap-3 px-3 py-2.5">
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                    style={{ backgroundColor: member.user?.accent_color ?? "#94a3b8" }}
                  >
                    {(member.user?.full_name || member.email)[0]?.toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.user?.full_name || member.email}
                      {member.user?.id === me?.id && (
                        <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      {member.status === "INVITED" && (
                        <Mail className="size-3 shrink-0" aria-hidden="true" />
                      )}
                      {member.status === "INVITED" ? "Invited — " : ""}
                      {member.email}
                    </p>
                  </div>
                  {iAmOwner && member.user?.id !== me?.id ? (
                    <>
                      <Select
                        value={member.role}
                        onValueChange={(value) => changeRole(member, value as ProjectRole)}
                      >
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Remove ${member.email}`}
                        onClick={() => remove(member)}
                      >
                        <Trash2 />
                      </Button>
                    </>
                  ) : (
                    <span className="text-xs capitalize text-muted-foreground">
                      {member.role.toLowerCase()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
