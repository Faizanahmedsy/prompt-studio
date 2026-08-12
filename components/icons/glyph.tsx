import {
  Badge,
  Calendar,
  ClipboardList,
  Compass,
  CreditCard,
  FileText,
  Gauge,
  Globe,
  HelpCircle,
  Image,
  Inbox,
  Layers,
  Lock,
  Mail,
  MessageSquare,
  Newspaper,
  Package,
  PanelBottom,
  Quote,
  Search,
  Settings,
  Shield,
  Smartphone,
  Sparkles,
  Table,
  Tag,
  TrendingUp,
  User,
  Users,
  Zap,
} from "lucide-react"

import { cn } from "@/lib/utils"

/** Icon keys used by the template and section-type catalogues. */
const glyphs = {
  lock: Lock,
  gauge: Gauge,
  table: Table,
  clipboard: ClipboardList,
  file: FileText,
  user: User,
  settings: Settings,
  shield: Shield,
  sparkles: Sparkles,
  "credit-card": CreditCard,
  package: Package,
  globe: Globe,
  search: Search,
  message: MessageSquare,
  calendar: Calendar,
  inbox: Inbox,
  smartphone: Smartphone,
  compass: Compass,
  badge: Badge,
  layers: Layers,
  trending: TrendingUp,
  quote: Quote,
  image: Image,
  tag: Tag,
  help: HelpCircle,
  users: Users,
  newspaper: Newspaper,
  mail: Mail,
  zap: Zap,
  "panel-bottom": PanelBottom,
} as const

export type GlyphName = keyof typeof glyphs

export function Glyph({
  name,
  className,
}: {
  name: string
  className?: string
}) {
  const Icon = glyphs[name as GlyphName] ?? FileText
  return <Icon className={cn("size-4", className)} aria-hidden="true" />
}
