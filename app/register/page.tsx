import { Suspense } from "react"

import { RegisterForm } from "@/features/auth/components/register-form"

export const metadata = { title: "Create an account · Prompt Studio" }

export default function RegisterPage() {
  // `useSearchParams` reads the `invite` token from a shared link, and Next
  // requires a boundary around any component that does.
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  )
}
