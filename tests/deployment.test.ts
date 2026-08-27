import { describe, expect, it } from "vitest"

import { deployMcps, iacTargets } from "@/features/deploy/data/targets"
import { starterDoc } from "@/features/library/data/starters"
import { buildProjectPrompt } from "@/features/prompt/engine/build-project-prompt"
import { buildPrompt } from "@/features/prompt/engine/build-prompt"
import { deploymentBlock } from "@/features/prompt/engine/deployment"
import { promptTargets } from "@/features/prompt/engine/targets"
import { type Deployment, type ProjectDoc, projectDocSchema } from "@/types/project"

const base = () => starterDoc("full-system")!
const withDeployment = (deployment: Partial<Deployment>): ProjectDoc => ({
  ...base(),
  target: "generic",
  deployment: { mcps: [], iac: "none", notes: "", ...deployment },
})

describe("the deployment answer is optional", () => {
  it("adds nothing at all when nothing is chosen", () => {
    expect(deploymentBlock(withDeployment({}))).toBe("")
    expect(buildPrompt(base()).text).not.toContain("Shipping It")
  })

  it("defaults to nothing chosen for a document that predates the field", () => {
    const { deployment, ...older } = base()
    const parsed = projectDocSchema.parse(older)
    expect(parsed.deployment).toEqual({ mcps: [], iac: "none", notes: "" })
  })

  it("ignores an MCP id it does not recognise instead of throwing", () => {
    const text = deploymentBlock(withDeployment({ mcps: ["vercel", "fly-io"] }))
    expect(text).toContain("Vercel")
    expect(text).not.toContain("fly-io")
  })

  it("emits a block for notes alone", () => {
    expect(deploymentBlock(withDeployment({ notes: "eu-west-1 only" }))).toContain(
      "eu-west-1 only"
    )
  })
})

describe("deploying with MCP servers", () => {
  it("names each selected server and only those", () => {
    const text = deploymentBlock(withDeployment({ mcps: ["vercel", "neon"] }))
    expect(text).toContain("**Vercel**")
    expect(text).toContain("**Neon**")
    expect(text).not.toContain("**Render**")
  })

  it("is multi-select — all three can be on at once", () => {
    const text = deploymentBlock(
      withDeployment({ mcps: deployMcps.map((mcp) => mcp.id) })
    )
    for (const mcp of deployMcps) expect(text).toContain(mcp.label.split(" ")[0])
  })

  it("asks for the live links and the credentials back", () => {
    const text = deploymentBlock(withDeployment({ mcps: ["vercel"] }))
    expect(text).toContain("every live URL")
    expect(text).toContain("sign-in credentials")
  })

  it("tells the agent to deploy rather than to describe deploying", () => {
    const text = deploymentBlock(withDeployment({ mcps: ["render"] }))
    expect(text).toContain("Deploy this project yourself")
    expect(text).toContain('do not stop at "ready to deploy"')
  })

  it("does not ask for an unmasked secret in the report", () => {
    const text = deploymentBlock(withDeployment({ mcps: ["neon", "vercel"] }))
    expect(text).toContain("masked")
    expect(text).toContain("never paste a live password")
  })
})

describe("AWS CDK", () => {
  it("is written, not deployed", () => {
    const text = deploymentBlock(withDeployment({ iac: "aws-cdk" }))
    expect(text).toContain("aws-cdk-lib")
    expect(text).toContain("cdk synth")
    expect(text).toContain("Do not run `cdk deploy`")
  })

  it("constrains the stack to what the app needs", () => {
    const text = deploymentBlock(withDeployment({ iac: "aws-cdk" }))
    expect(text).toContain("Minimal means minimal")
    // The specific over-provisioning an unconstrained agent reaches for.
    expect(text).toContain("NAT gateway")
    expect(text).toContain("no VPC unless")
  })

  it("says nothing when the choice is none", () => {
    expect(deploymentBlock(withDeployment({ iac: "none" }))).toBe("")
  })

  it("reconciles the two when both are chosen", () => {
    const text = deploymentBlock(
      withDeployment({ mcps: ["vercel"], iac: "aws-cdk" })
    )
    expect(text).toContain("not in conflict")
    expect(text).toContain("which one is currently serving traffic")
  })

  it("offers exactly the two documented choices", () => {
    expect(iacTargets.map((t) => t.id)).toEqual(["none", "aws-cdk"])
  })
})

describe("where the block lands", () => {
  it("appears in every target's prompt", () => {
    for (const target of promptTargets) {
      const doc = { ...withDeployment({ mcps: ["vercel"] }), target: target.id }
      expect(buildPrompt(doc).text).toContain("**Vercel**")
    }
  })

  it("appears once in the multi-build prompt, not once per build", () => {
    const text = buildProjectPrompt(withDeployment({ mcps: ["render"] })).text
    expect(text.split("**Render**").length - 1).toBe(1)
  })

  it("comes after the definition of done and before the honesty clause", () => {
    const text = buildPrompt(withDeployment({ mcps: ["vercel"] })).text
    expect(text.indexOf("Shipping It")).toBeGreaterThan(
      text.indexOf("Definition of Done")
    )
    expect(text.indexOf("Shipping It")).toBeLessThan(
      text.indexOf("Before You Report Back")
    )
  })
})
