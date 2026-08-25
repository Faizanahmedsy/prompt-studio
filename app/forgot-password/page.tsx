import { Suspense } from "react"

import { ForgotPasswordForm } from "@/features/auth/components/password-forms"

export const metadata = { title: "Reset your password · Prompt Studio" }

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  )
}
