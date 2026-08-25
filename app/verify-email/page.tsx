import { Suspense } from "react"

import { VerifyEmailScreen } from "@/features/auth/components/password-forms"

export const metadata = { title: "Confirm your email · Prompt Studio" }

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailScreen />
    </Suspense>
  )
}
