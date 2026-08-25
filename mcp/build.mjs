/**
 * Bundles the MCP server into one file.
 *
 * A bundle rather than `tsc` output because the server imports the studio's own
 * parser, serializer and prompt engine through the `@/` alias the whole app
 * uses. Compiling alone leaves those specifiers in the output and Node cannot
 * resolve them; rewriting every import to a relative path instead would mean
 * the MCP server and the app disagree about how to refer to the same module.
 * One alias, declared here, keeps them in step.
 */

import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { build } from "esbuild"

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, "..")

await build({
  entryPoints: [resolve(here, "src/server.ts")],
  outfile: resolve(here, "dist/server.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  alias: { "@": root },
  banner: { js: "#!/usr/bin/env node" },
  logLevel: "info",
})
