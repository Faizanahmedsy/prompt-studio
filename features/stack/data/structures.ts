export type StructurePreset = {
  id: string
  name: string
  description: string
  tree: string
  notes: string[]
}

export const structurePresets: StructurePreset[] = [
  {
    id: "feature-based",
    name: "Feature-based (house standard)",
    description: "One folder per product area, shared UI extracted.",
    tree: `app/                  # App Router. Route groups:
  (app)/              #   protected routes (wrapped by the app shell)
  (auth)/             #   public auth routes — no shell
  layout.tsx          #   fonts + theme provider + providers + toaster
  providers.tsx
config/
  env.ts              # validated env, exported as ENV
  api/api.ts          # endpoint catalogue
  instance/           # http instance + interceptors
features/
  <feature>/          # one folder per product area
    index.ts          #   public entry — cross-feature imports go through it
    components/       #   feature-only components
    services/         #   data hooks built on the generic hooks
    data/             #   schemas + static data
    types/            #   feature-local types
    utils/            #   feature-local helpers
components/
  ui/                 # design-system primitives
  shared/             # cross-feature components (form/ table/ feedback/ display/)
  layout/             # app shell, header, navigation
hooks/                # generic reusable hooks
stores/               # client state stores
types/                # cross-app types
lib/                  # low-level utils (cn, formatters)`,
    notes: [
      "A feature's `index.ts` is its only public surface — never import another feature's internals directly.",
      "Anything used by two features moves to `components/shared/` or `hooks/`.",
    ],
  },
  {
    id: "src-layered",
    name: "src/ layered",
    description: "Classic src tree grouped by technical role.",
    tree: `src/
  app/                # routes
  components/         # ui + shared components
  hooks/
  services/           # api clients
  store/
  types/
  utils/
  styles/`,
    notes: ["Group by technical role; keep each folder shallow."],
  },
  {
    id: "atomic",
    name: "Atomic design",
    description: "atoms → molecules → organisms → templates → pages.",
    tree: `src/
  components/
    atoms/
    molecules/
    organisms/
    templates/
  pages/
  hooks/
  services/
  styles/`,
    notes: [
      "Promote a component up a level only when it is reused, not by anticipation.",
    ],
  },
  {
    id: "route-colocated",
    name: "Route-colocated",
    description: "Everything a route needs lives beside the route.",
    tree: `app/
  dashboard/
    page.tsx
    _components/
    _hooks/
    _lib/
  clients/
    page.tsx
    [id]/page.tsx
    _components/
components/            # only genuinely shared UI
lib/`,
    notes: [
      "Private folders (`_components`) stay out of the router.",
      "Promote to the top-level `components/` on the second consumer.",
    ],
  },
  {
    id: "flat",
    name: "Flat / small app",
    description: "Minimal ceremony for a small surface.",
    tree: `app/
components/
lib/
types/`,
    notes: ["Fine below roughly a dozen screens; split by feature after that."],
  },
  {
    id: "custom",
    name: "Custom",
    description: "Paste your own tree — used verbatim in the prompt.",
    tree: "",
    notes: [],
  },
]

export const structureMap = Object.fromEntries(
  structurePresets.map((s) => [s.id, s])
) as Record<string, StructurePreset>
