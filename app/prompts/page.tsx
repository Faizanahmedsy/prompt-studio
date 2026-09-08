import { PublicPrompts } from "@/features/marketing/components/public-prompts"

export const metadata = {
  title: "Prompt library · Prompt Studio",
  description:
    "Whole, hand-written prompts for design, building, debugging, review and planning — free, no account needed. Copy one into Claude, ChatGPT, Cursor or anything else.",
}

export default function Page() {
  return <PublicPrompts />
}
