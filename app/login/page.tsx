import { Suspense } from "react"

import { SignInForm } from "@/features/auth/components/sign-in-form"

export const metadata = { title: "Sign in · Prompt Studio" }

export default function LoginPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  )
}
