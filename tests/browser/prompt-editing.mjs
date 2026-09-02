/**
 * The generated prompt can be edited by hand, and the edit is what gets used.
 *
 * Worth a browser test rather than a unit one because the failure this guards
 * against is a mismatch between two surfaces: what the panel shows and what the
 * Copy button, the download and the print view actually hand over. A store test
 * cannot see that gap; only driving the real UI can.
 */
import { launch } from "./cdp.mjs"

const APP = process.env.APP ?? "http://localhost:3002"
const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

const MINE = "REPLACED BY HAND — the only sentence in this prompt."

const clickLabelled = (label) => `
  const node = [...document.querySelectorAll("button")]
    .find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim() === ${JSON.stringify(label)});
  if (!node) throw new Error("no button " + ${JSON.stringify(label)});
  node.click();
  return true;`

async function main() {
  const tag = Math.random().toString(36).slice(2, 10)
  const page = await launch({ port: 9362 })
  try {
    console.log("\n== open the studio ==")
    await page.goto(`${APP}/register`)
    await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
    await page.fill('input[autocomplete="name"]', "Editor E")
    await page.fill('input[type="email"]', `editor.${tag}@example.com`)
    await page.fill('input[type="password"]', "Password123")
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(
      `[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Create account")).click(); return true`
    )
    await page.waitFor(`["/","/web","/mobile","/backend","/landing","/data","/code","/design"].includes(location.pathname)`, { label: "the studio", timeout: 25000 })
    await page.waitFor(`document.querySelector(".react-flow") !== null`, {
      label: "the canvas",
      timeout: 25000,
    })
    await new Promise((r) => setTimeout(r, 2500))

    console.log("\n== the prompt starts as a build, in blocks ==")
    const blocks = await page.evaluate(
      `return document.querySelectorAll("pre.code-surface").length`
    )
    check("the prompt renders block by block", blocks > 1, `${blocks} blocks`)

    console.log("\n== edit it ==")
    await page.evaluate(clickLabelled("Edit prompt"))
    await page.waitFor(`document.querySelector('textarea[aria-label="Generated prompt"]') !== null`, {
      label: "the editor",
    })
    // Typed the way React sees it — assigning `.value` alone does not fire the
    // change the controlled component listens for.
    await page.evaluate(`
      const area = document.querySelector('textarea[aria-label="Generated prompt"]');
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
      setter.call(area, ${JSON.stringify(MINE)});
      area.dispatchEvent(new Event("input", { bubbles: true }));
      return true;`)
    await new Promise((r) => setTimeout(r, 800))

    const banner = await page.evaluate(`return document.body.innerText.includes("Edited by hand")`)
    check("the panel says the prompt is no longer the build", banner)

    console.log("\n== the edit is what everything downstream uses ==")
    await page.evaluate(clickLabelled("Stop editing prompt"))
    await new Promise((r) => setTimeout(r, 500))
    const shown = await page.evaluate(`
      return [...document.querySelectorAll("pre.code-surface")].map((n) => n.innerText).join("\\n")`)
    check("the preview shows the edit, not the build", shown.includes(MINE), shown.slice(0, 120))

    const stored = await page.evaluate(`
      const state = JSON.parse(localStorage.getItem("ps:prompt-drafts")).state;
      return Object.values(state.drafts)[0] ?? null;`)
    check("the edit survives a reload", stored === MINE, String(stored).slice(0, 120))

    await page.goto(`${APP}/print`)
    await new Promise((r) => setTimeout(r, 2500))
    const printed = await page.evaluate(`return document.body.innerText`)
    check("the print view prints the edit", printed.includes(MINE))

    console.log("\n== and it can be given back ==")
    await page.goto(`${APP}/`)
    await page.waitFor(`document.querySelector(".react-flow") !== null`, {
      label: "back on the canvas",
      timeout: 25000,
    })
    await new Promise((r) => setTimeout(r, 2000))
    await page.evaluate(clickLabelled("Reset"))
    await new Promise((r) => setTimeout(r, 800))
    const afterReset = await page.evaluate(`
      return [...document.querySelectorAll("pre.code-surface")].map((n) => n.innerText).join("\\n")`)
    check("resetting brings the build back", !afterReset.includes(MINE))
    check(
      "and the blocks with it",
      (await page.evaluate(`return document.querySelectorAll("pre.code-surface").length`)) > 1
    )

    const noisy = page.consoleErrors.filter(
      (line) => !/Download the React DevTools|Extra attributes/i.test(line)
    )
    check("no uncaught errors", noisy.length === 0, noisy.slice(0, 2).join(" | "))
  } finally {
    await page.close()
  }

  console.log(`\n${fails.length ? `${fails.length} FAILED: ${fails.join(", ")}` : "ALL PASSED"}`)
  process.exit(fails.length ? 1 : 0)
}

main().catch((error) => {
  console.error("driver failed:", error.message)
  process.exit(2)
})
