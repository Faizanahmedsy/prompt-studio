import { Suspense } from "react"

import { SetInitialPasswordForm } from "@/features/auth/components/password-forms"

export const metadata = { title: "Set your password · Prompt Studio" }

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetInitialPasswordForm />
    </Suspense>
  )
}
