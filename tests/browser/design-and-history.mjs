/**
 * The design editor and the version history, in a real browser.
 *
 * Both are new and neither had any coverage: the design tab is where a person
 * decides what everything they generate will look like, and the history is the
 * only way back from a bad decision. The unit tests cover the resolver and the
 * mappers; what they cannot show is whether the tab opens, whether a preset
 * actually repaints the preview, and whether the history the dialog lists is
 * the server's or the browser's.
 */
import { launch } from "./cdp.mjs"

const APP = process.env.APP ?? "http://localhost:3002"
const PASSWORD = "Password123"
const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

/**
 * Radix menus open on `pointerdown`, not `click` — a bare `.click()` leaves the
 * menu shut and the item you wanted unreachable.
 */
const openMenu = (text) => `
  const node = [...document.querySelectorAll("button")]
    .find((b) => (b.textContent || "").toLowerCase().includes(${JSON.stringify(text)}));
  if (!node) throw new Error("no menu called " + ${JSON.stringify(text)});
  node.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, isPrimary: true, button: 0 }));
  node.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, isPrimary: true, button: 0 }));
  node.click();
  return true;`

const clickMenuItem = (text) => `
  const node = [...document.querySelectorAll('[role="menuitem"]')]
    .find((b) => (b.textContent || "").toLowerCase().includes(${JSON.stringify(text)}));
  if (!node) throw new Error("no menu item " + ${JSON.stringify(text)});
  node.click();
  return true;`

const clickText = (text) => `
  const node = [...document.querySelectorAll("button, a")]
    .find((b) => (b.textContent || "").trim().toLowerCase().includes(${JSON.stringify(text)}));
  if (!node) throw new Error("nothing says " + ${JSON.stringify(text)});
  node.click();
  return true;`

/**
 * The tokens are scoped to the preview element rather than the document, so a
 * dark preset cannot repaint the editor's own chrome. That is also why this
 * reads them off that element and not off the section around it.
 */
const previewVar = (name) => `
  const panel = document.querySelector('[data-screen="app"] [style*="--pv-"]');
  if (!panel) throw new Error("no preview");
  return getComputedStyle(panel).getPropertyValue(${JSON.stringify(name)}).trim();`

async function main() {
  const tag = Math.random().toString(36).slice(2, 10)
  const page = await launch({ port: 9380 })
  try {
    console.log("\n== sign up and open the design tab ==")
    await page.goto(`${APP}/register`)
    await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
    await page.fill('input[autocomplete="name"]', "Design Dana")
    await page.fill('input[type="email"]', `design.${tag}@example.com`)
    await page.fill('input[type="password"]', PASSWORD)
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(clickText("create account"))
    await page.waitFor(`document.querySelector(".react-flow") !== null`, {
      label: "the canvas",
      timeout: 25000,
    })

    // The tab is a path now, so this is also the check that the link works.
    await page.goto(`${APP}/design`)
    await page.waitFor(`document.body.innerText.includes("PRESET")`, {
      label: "the design editor",
      timeout: 20000,
    })
    check("/design opens the editor directly", true)
    check(
      "and stays on that path, so the link can be sent",
      (await page.evaluate(`return location.pathname`)) === "/design"
    )

    console.log("\n== a preset repaints the preview ==")
    await page.waitFor(`document.querySelector('[data-screen="app"]') !== null`, {
      label: "the preview",
      timeout: 20000,
    })
    // The store rehydrates from localStorage after mount, and a write that
    // lands before that is overwritten by it. A person cannot realistically
    // click this fast; a driver can.
    await new Promise((r) => setTimeout(r, 1500))
    const before = await page.evaluate(previewVar("--pv-primary"))
    await page.evaluate(clickText("telegraph"))
    await new Promise((r) => setTimeout(r, 1500))
    const after = await page.evaluate(previewVar("--pv-primary"))
    const chosen = await page.evaluate(
      `const s = JSON.parse(localStorage.getItem("ps:v1")); return s.state.projects.find((p) => p.id === s.state.activeId).theme.preset`
    )
    check("the choice is written to the project", chosen === "telegraph", `preset is ${chosen}`)
    check("choosing a preset changes the palette", Boolean(before) && before !== after, `${before} -> ${after}`)

    const fontBefore = await page.evaluate(previewVar("--pv-font-display"))
    check("and the typeface with it", fontBefore.includes("Roboto Slab"), fontBefore)

    console.log("\n== the dials move something ==")
    await page.evaluate(clickText("shuffle"))
    await new Promise((r) => setTimeout(r, 500))
    const fontAfter = await page.evaluate(previewVar("--pv-font-display"))
    check("shuffle draws a different pairing", fontAfter !== fontBefore, `${fontBefore} -> ${fontAfter}`)

    await page.evaluate(clickText("reset all"))
    await new Promise((r) => setTimeout(r, 600))
    const reset = await page.evaluate(previewVar("--pv-font-display"))
    check("reset puts the default back", reset.includes("Source Sans"), reset)

    console.log("\n== back to the canvas ==")
    await page.goto(`${APP}/web`)
    await page.waitFor(`document.querySelector(".react-flow") !== null`, {
      label: "the canvas again",
      timeout: 25000,
    })

    console.log("\n== an edit, so there is something to attribute ==")
    const before2 = await page.evaluate(
      `return document.querySelectorAll('.react-flow__node').length`
    )
    await page.waitFor(
      `[...document.querySelectorAll("button")].some((b) => (b.textContent || "").includes("Add screen"))`,
      { label: "the add-screen button", timeout: 20000 }
    )
    await page.evaluate(clickText("add screen"))
    await page.waitFor(`document.querySelector('[data-radix-popper-content-wrapper] button') !== null`, {
      label: "the template picker",
      timeout: 15000,
    })
    await page.evaluate(
      `document.querySelector('[data-radix-popper-content-wrapper] button').click(); return true`
    )
    await page.waitFor(
      `document.querySelectorAll('.react-flow__node').length > ${before2}`,
      { label: "the new screen", timeout: 15000 }
    )
    // Past both debounces, so the save has actually reached the server.
    await new Promise((r) => setTimeout(r, 2500))
    check("a screen can be added", true)

    console.log("\n== version history comes from the server ==")
    await page.waitFor(
      `(() => { try { return Object.keys(JSON.parse(localStorage.getItem("ps:sync")).state.links).length > 0 } catch { return false } })()`,
      { label: "the project linked to the account", timeout: 30000 }
    )
    // The history lives behind the project menu, which is where a person looks
    // for it — everything about one project is in that one menu.
    await page.evaluate(openMenu("my first project"))
    await new Promise((r) => setTimeout(r, 500))
    await page.evaluate(clickMenuItem("version history"))
    await new Promise((r) => setTimeout(r, 800))
    const opened = await page.evaluate(`return document.body.innerText.includes("Version history")`)
    check("the history dialog opens", opened)
    check(
      "and says it is the shared one, not this browser's",
      await page.evaluate(`return document.body.innerText.includes("kept on the server")`)
    )

    await page.evaluate(clickText("save current version"))
    await page.waitFor(`document.body.innerText.includes("Saved by hand")`, {
      label: "the saved version",
      timeout: 20000,
    })
    check("saving a version lists it", true)
    check(
      "with the person who saved it",
      await page.evaluate(`return document.body.innerText.includes("Design Dana")`)
    )
    check(
      "and who has been editing",
      // Case-insensitive: the heading is uppercased in CSS, and `innerText`
      // reports what is rendered rather than what is written.
      await page.evaluate(
        `return /recent edits/i.test(document.body.innerText) && /\\d+ saves?/.test(document.body.innerText)`
      )
    )

    console.log("\n== what you're building, after the fact ==")
    // The decision made in the new-project dialog has to be changeable later.
    // It always was — in a panel named Brief — which is why nobody found it.
    await page.evaluate(`
      const dialog = document.querySelector('[role="dialog"] button[aria-label], [role="dialog"]');
      const close = [...document.querySelectorAll("button")].find((b) => (b.getAttribute("aria-label") || "") === "Close");
      if (close) close.click();
      return true;`)
    await new Promise((r) => setTimeout(r, 500))
    await page.evaluate(openMenu("my first project"))
    await new Promise((r) => setTimeout(r, 500))
    check(
      "the menu says what is being built",
      /web/i.test(await page.evaluate(`return document.body.innerText`))
    )
    await page.evaluate(clickMenuItem("what you"))
    await page.waitFor(`/what you.{0,3}re building/i.test(document.body.innerText)`, {
      label: "the scope dialog",
      timeout: 15000,
    })
    check("and opens a dialog to change it", true)

    const beforeBuilds = await page.evaluate(
      `const s = JSON.parse(localStorage.getItem("ps:v1")); return JSON.stringify(s.state.projects.find((p) => p.id === s.state.activeId).builds)`
    )
    await page.evaluate(`
      const row = [...document.querySelectorAll('[role="dialog"] *')]
        .find((n) => (n.textContent || "").trim().startsWith("Backend"));
      const box = row.closest("label, div").querySelector('button[role="checkbox"], input[type="checkbox"]');
      box.click();
      return true;`)
    await new Promise((r) => setTimeout(r, 800))
    const afterBuilds = await page.evaluate(
      `const s = JSON.parse(localStorage.getItem("ps:v1")); return JSON.stringify(s.state.projects.find((p) => p.id === s.state.activeId).builds)`
    )
    check("turning a build on is written to the project", beforeBuilds !== afterBuilds, `${beforeBuilds} -> ${afterBuilds}`)

    const priorityBefore = await page.evaluate(
      `const s = JSON.parse(localStorage.getItem("ps:v1")); return s.state.projects.find((p) => p.id === s.state.activeId).priority`
    )
    await page.evaluate(`
      const row = [...document.querySelectorAll('[role="dialog"] *')]
        .find((n) => (n.textContent || "").trim().startsWith("Interface first"));
      const toggle = row.closest("label, div").querySelector('button[role="switch"]');
      toggle.click();
      return true;`)
    await new Promise((r) => setTimeout(r, 800))
    const priorityAfter = await page.evaluate(
      `const s = JSON.parse(localStorage.getItem("ps:v1")); return s.state.projects.find((p) => p.id === s.state.activeId).priority`
    )
    check(
      "and so is interface-first",
      priorityBefore !== priorityAfter,
      `${priorityBefore} -> ${priorityAfter}`
    )

    console.log("\n== console health ==")
    const noisy = page.consoleErrors.filter(
      (line) => !/Failed to load resource|DevTools|net::/i.test(line)
    )
    check("no uncaught errors", noisy.length === 0, noisy.slice(0, 2).join(" | "))
  } finally {
    await page.close()
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
