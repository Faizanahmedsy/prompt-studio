"use client"

import { SelectField, TextAreaField, ToggleRow } from "@/components/shared/form"
import { SectionLabel } from "@/components/shared/layout"
import { deployMcps, iacTargets } from "@/features/deploy/data/targets"
import { useProjectStore } from "@/stores/use-project-store"
import type { Project } from "@/types/project"

/**
 * Project-wide, unlike everything else in this panel.
 *
 * The stack, structure and conventions above are per surface — three builds,
 * three answers. Deployment is one answer for the product: the web app, the API
 * and the database land together or the preview is broken.
 */
export function DeploymentPanel({ project }: { project: Project }) {
  const update = useProjectStore((s) => s.update)
  const deployment = project.deployment
  const chosen = deployment.mcps

  return (
    <section className="space-y-2 border-t border-border pt-4">
      <SectionLabel>Deployment</SectionLabel>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Applies to the whole project, not just the build you are editing.
      </p>

      <div className="space-y-0.5">
        <p className="pt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
          Deploy with MCP servers
        </p>
        <p className="pb-1 text-[11px] leading-snug text-muted-foreground">
          The agent provisions and deploys during the build, then hands back the
          live links and sign-in credentials.
        </p>
        {deployMcps.map((mcp) => (
          <ToggleRow
            key={mcp.id}
            variant="checkbox"
            title={mcp.label}
            description={mcp.hint}
            checked={chosen.includes(mcp.id)}
            onCheckedChange={(checked) =>
              update((doc) => {
                doc.deployment.mcps = checked
                  ? [...doc.deployment.mcps, mcp.id]
                  : doc.deployment.mcps.filter((id) => id !== mcp.id)
              })
            }
          />
        ))}
      </div>

      <div className="space-y-1 pt-2">
        <SelectField
          label="Infrastructure as code"
          hint="Written into the repo for you to run — nothing is provisioned."
          value={deployment.iac}
          onValueChange={(value) =>
            update((doc) => {
              doc.deployment.iac = value
            })
          }
          options={iacTargets.map((target) => ({
            value: target.id,
            label: target.label,
          }))}
        />
        <p className="text-[11px] leading-snug text-muted-foreground">
          {iacTargets.find((t) => t.id === deployment.iac)?.hint}
        </p>
      </div>

      {(chosen.length > 0 || deployment.iac !== "none") && (
        <TextAreaField
          label="Deployment notes"
          hint="Region, domain, account, anything the agent should not guess at."
          rows={2}
          value={deployment.notes}
          onChange={(event) =>
            update((doc) => {
              doc.deployment.notes = event.target.value
            })
          }
        />
      )}
    </section>
  )
}
