import { Suspense } from "react"

import { ResetPasswordForm } from "@/features/auth/components/password-forms"

export const metadata = { title: "Choose a new password · Prompt Studio" }

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
