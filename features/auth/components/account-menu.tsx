"use client"

import { CloudOff, KeyRound, LogOut, Shield, User as UserIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ApiTokensDialog } from "@/features/auth/components/api-tokens-dialog"
import { useAuthStore } from "@/stores/use-auth-store"

const API_ORIGIN = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8010"

export function AccountMenu() {
  const router = useRouter()
  const user = useAuthStore((s) => s.user)
  const status = useAuthStore((s) => s.status)
  const bootstrap = useAuthStore((s) => s.bootstrap)
  const logout = useAuthStore((s) => s.logout)
  const [tokensOpen, setTokensOpen] = useState(false)

  // Signed in, but the server could not be asked who we are — so the honest
  // thing is to say that rather than render an avatar for a name we do not
  // actually know. Leaving the slot empty would look like a missing control.
  if (!user && status === "offline") {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Working offline — retry connecting"
        title="Working offline. Your changes are saved on this device."
        onClick={() => void bootstrap()}
      >
        <CloudOff className="text-muted-foreground" />
      </Button>
    )
  }

  if (!user) return null

  const isAdmin =
    user.is_superuser || user.role === "ADMIN" || user.role === "SUPERADMIN"

  return (
    <>
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Your account">
          <span
            className="flex size-6 items-center justify-center rounded-full text-[10px] font-semibold text-white"
            style={{ backgroundColor: user.accent_color }}
          >
            {(user.full_name || user.email)[0]?.toUpperCase()}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="flex flex-col gap-0.5">
          <span className="truncate text-sm">{user.full_name || "Your account"}</span>
          <span className="truncate text-[11px] font-normal text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="gap-2 text-xs">
          <UserIcon className="size-3.5" />
          {user.project_count} project{user.project_count === 1 ? "" : "s"} ·{" "}
          {user.role.toLowerCase()}
        </DropdownMenuItem>
        <DropdownMenuItem className="gap-2" onSelect={() => setTokensOpen(true)}>
          <KeyRound className="size-3.5" />
          API tokens
        </DropdownMenuItem>
        {isAdmin && (
          // The panel is served by the API itself, so it keeps working when the
          // frontend is down — which is exactly when an operator needs it.
          <DropdownMenuItem asChild>
            <a href={`${API_ORIGIN}/admin`} target="_blank" rel="noreferrer" className="gap-2">
              <Shield className="size-3.5" />
              Admin panel
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-destructive focus:text-destructive"
          onSelect={async () => {
            await logout()
            router.replace("/login")
          }}
        >
          <LogOut className="size-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <ApiTokensDialog open={tokensOpen} onOpenChange={setTokensOpen} />
    </>
  )
}
