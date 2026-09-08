/**
 * The two answers to "who decides the design", in a real browser.
 *
 * The engine has unit tests; what they cannot see is whether the choice reaches
 * the generated prompt through the store, the panel and the Copy button — the
 * path a person actually uses.
 *
 * Clicks are dispatched as real mouse events rather than `node.click()`. The
 * mode cards do not respond to a synthetic click, and neither would a person's
 * mouse if they were covered — so the real event is both the working test and
 * the honest one. The clipboard is read by wrapping `writeText` instead of
 * granting permissions: a headless tab is not focused, and `readText` refuses.
 */
import { launch } from "./cdp.mjs"

const APP = process.env.APP ?? "http://localhost:3002"
const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

const CAPTURE = `
  window.__copied = "";
  const write = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = (text) => { window.__copied = text; return write(text).catch(() => {}); };
  return true;`

const modeOf = `
  const store = JSON.parse(localStorage.getItem("ps:v1"));
  const project = store.state.projects.find((p) => p.id === store.state.activeId);
  return String(project.theme.designMode);`

async function clickAria(page, label) {
  await clearToasts(page)
  const box = await page.evaluate(`
    const node = [...document.querySelectorAll("button")]
      .find((b) => (b.getAttribute("aria-label") || "") === ${JSON.stringify(label)});
    if (!node) throw new Error("no button labelled " + ${JSON.stringify(label)});
    node.scrollIntoView({ block: "center" });
    const r = node.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });`)
  const at = JSON.parse(box)
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", ...at, button: "left", clickCount: 1 })
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...at, button: "left", clickCount: 1 })
  await new Promise((r) => setTimeout(r, 700))
}

/**
 * Toasts sit above everything, so a real mouse click can land on one instead of
 * the control underneath. They are waited out rather than removed: they belong
 * to React, and pulling them out of the DOM makes the next render throw.
 */
async function clearToasts(page) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const present = await page.evaluate(
      `return document.querySelectorAll("[data-sonner-toast]").length > 0`
    )
    if (!present) return
    await new Promise((r) => setTimeout(r, 500))
  }
}

async function clickButton(page, text) {
  await clearToasts(page)
  const box = await page.evaluate(`
    const node = [...document.querySelectorAll("button")]
      .find((b) => (b.textContent || "").toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
    if (!node) throw new Error("no button matching " + ${JSON.stringify(text)});
    node.scrollIntoView({ block: "center" });
    const r = node.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });`)
  const at = JSON.parse(box)
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", ...at, button: "left", clickCount: 1 })
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...at, button: "left", clickCount: 1 })
  await new Promise((r) => setTimeout(r, 700))
}

async function main() {
  const tag = Math.random().toString(36).slice(2, 10)
  const page = await launch({ port: 9380 })
  try {
    console.log("\n== sign up and open the design tab ==")
    await page.goto(`${APP}/register`)
    await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
    await page.fill('input[autocomplete="name"]', "Design Dana")
    await page.fill('input[type="email"]', `design.${tag}@example.com`)
    await page.fill('input[type="password"]', "Password123")
    await new Promise((r) => setTimeout(r, 400))
    await clickButton(page, "create account")
    await page.waitFor(
      `["/web","/mobile","/backend","/landing","/data","/code","/design"].includes(location.pathname)`,
      { label: "the studio", timeout: 25000 }
    )

    await page.goto(`${APP}/design`)
    await page.waitFor(`document.body.innerText.toLowerCase().includes("who decides the design")`, {
      label: "the design tab",
      timeout: 25000,
    })
    check("the design tab opens at its own URL and offers both answers", true)
    check("a new project decides its own design", (await page.evaluate(modeOf)) === "preset")

    console.log("\n== let Claude decide ==")
    await clickButton(page, "Let Claude decide")
    check("the choice reaches the document", (await page.evaluate(modeOf)) === "auto")
    check(
      "and the panel says what the agent is told",
      await page.evaluate(`return document.body.innerText.toLowerCase().includes("what the agent is told")`)
    )
    // The right-hand pane must stop showing a preset it is not using: nothing
    // on it would be what the build looks like.
    await page.waitFor(`document.querySelector("article") !== null`, {
      label: "the brief pane",
      timeout: 15000,
    })
    const pane = await page.evaluate(`
      const article = document.querySelector("article");
      return (document.body.innerText.includes("The brief the agent gets") ? "HEADER|" : "") + (article ? article.innerText : "");`)
    check("the preview is replaced by the brief itself", pane.startsWith("HEADER|"))
    check(
      "and the preset screens are gone",
      !(await page.evaluate(`return document.body.innerText.includes("No runs match these filters")`))
    )
    check(
      "the brief is readable, not a wall of markdown",
      // The headings render uppercase, so this compares case-insensitively.
      pane.toLowerCase().includes("write the design plan before any code") &&
        !pane.includes("###"),
      JSON.stringify(pane.slice(0, 160))
    )

    console.log("\n== the design-only prompt ==")
    await page.evaluate(CAPTURE)
    await clickButton(page, "Design only")
    const design = await page.evaluate(`return window.__copied`)
    check("copies the brief", design.includes("Write the design plan before any code"), design.slice(0, 100))
    check("names the product it is for", design.includes("Design this"), design.slice(0, 100))
    check("ships no stylesheet", !design.includes("--background"))
    check(
      "and leaves the flow out of it",
      !design.includes("Folder structure") && !design.includes("Navigation transitions"),
      "the flow came along"
    )

    console.log("\n== the build prompt follows the same choice ==")
    await page.goto(`${APP}/web`)
    await page.waitFor(`document.querySelector(".react-flow") !== null`, {
      label: "the canvas",
      timeout: 25000,
    })
    await page.evaluate(CAPTURE)
    // The header's "Copy prompt" is the menu of authoring prompts; the build
    // prompt is copied from the prompt panel, which is where a person reads it.
    await clickAria(page, "Copy prompt")
    const built = await page.evaluate(`return window.__copied`)
    check("hands the design to the agent", built.includes("You own the visual design"), built.slice(0, 100))
    check("ships no stylesheet alongside the brief", !built.includes("--background"))
    check("and still describes the product", built.toLowerCase().includes("screen"))

    console.log("\n== and back ==")
    await page.goto(`${APP}/design`)
    await page.waitFor(`document.body.innerText.toLowerCase().includes("who decides the design")`, {
      label: "the design tab again",
      timeout: 25000,
    })
    await clickButton(page, "Choose it here")
    check("the choice is reversible", (await page.evaluate(modeOf)) === "preset")
    check(
      "and the screens come back",
      await page.evaluate(`return document.body.innerText.includes("No runs match these filters")`)
    )
    await page.evaluate(CAPTURE)
    await clickButton(page, "Design only")
    const tokens = await page.evaluate(`return window.__copied`)
    check("and the token file comes back", tokens.includes("--background"), tokens.slice(0, 100))

    check("no uncaught errors", page.consoleErrors.length === 0, page.consoleErrors.slice(0, 2).join(" | "))
  } finally {
    await page.close?.()
  }

  if (fails.length) {
    console.log(`\n${fails.length} FAILED: ${fails.join(", ")}`)
    process.exit(1)
  }
  console.log("\nALL PASSED")
}

main().catch((error) => {
  console.error("driver failed:", error.message)
  process.exit(1)
})
