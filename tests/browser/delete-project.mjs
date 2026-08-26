/**
 * Deleting a project deletes it — on the server, not just in this browser.
 *
 * The bug this exists for: the menu only emptied localStorage, so the row
 * survived, the next pull found a project with no link, and it came back under
 * a fresh local id. Delete read as "flicker, then reappear", and doing it twice
 * left two copies. A reload is therefore the whole point of this test — the old
 * behaviour passed every check that did not reload.
 */
import { launch } from "./cdp.mjs"

const APP = process.env.APP ?? "http://localhost:3002"
const API = process.env.API ?? "http://127.0.0.1:8010"
const PASSWORD = "Password123"
const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

const clickText = (text) => `
  const node = [...document.querySelectorAll("button, [role=menuitem]")]
    .find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().startsWith(${JSON.stringify(text)}));
  if (!node) throw new Error("no control " + ${JSON.stringify(text)});
  node.click();
  return true;`

const projectNames = `
  const store = JSON.parse(localStorage.getItem("ps:v1"));
  return store.state.projects.map((p) => p.name);`

/** Radix menus open on pointerdown, not click. */
const openProjectMenu = `
  const trigger = [...document.querySelectorAll("button")]
    .find((b) => b.getAttribute("aria-haspopup") === "menu");
  if (!trigger) throw new Error("no project menu trigger");
  for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
    trigger.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true }));
  }
  return true;`

async function main() {
  const tag = Math.random().toString(36).slice(2, 10)
  const page = await launch({ port: 9364 })
  try {
    console.log("\n== sign up, land on a synced project ==")
    await page.goto(`${APP}/register`)
    await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
    await page.fill('input[autocomplete="name"]', "Deleter D")
    await page.fill('input[type="email"]', `deleter.${tag}@example.com`)
    await page.fill('input[type="password"]', PASSWORD)
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(clickText("Create account"))
    await page.waitFor(`location.pathname === "/"`, { label: "the studio", timeout: 25000 })
    await page.waitFor(
      `(() => { try { return Object.keys(JSON.parse(localStorage.getItem("ps:sync")).state.links).length > 0 } catch { return false } })()`,
      { label: "linked to the server", timeout: 30000 }
    )
    const token = await page.evaluate(`return localStorage.getItem("prompt-studio.access_token")`)

    const serverCount = async () => {
      const body = await fetch(`${API}/api/v1/projects?size=100`, {
        headers: { Authorization: `Bearer ${token}` },
      }).then((r) => r.json())
      return body.data.total
    }

    const before = await serverCount()
    const localBefore = await page.evaluate(projectNames)
    check("the project exists on the server", before > 0, `server has ${before}`)

    console.log("\n== delete it ==")
    const target = localBefore[0]
    await page.evaluate(openProjectMenu)
    await page.waitFor(`document.querySelector('[role=menu]') !== null`, { label: "the menu" })
    await page.evaluate(clickText("Delete project"))
    await page.waitFor(`document.body.innerText.includes("Delete “")`, { label: "the confirm dialog" })
    await page.evaluate(clickText("Delete project"))
    await new Promise((r) => setTimeout(r, 2500))

    const localAfter = await page.evaluate(projectNames)
    check("it is gone from this browser", !localAfter.includes(target), localAfter.join(", "))

    const after = await serverCount()
    check("and gone from the server", after === before - 1, `server has ${after}, expected ${before - 1}`)

    console.log("\n== and it stays gone ==")
    // The whole bug in one step: the old code passed everything above.
    await page.goto(`${APP}/`)
    // Deleting the last project is allowed to leave the studio empty now, so
    // the honest landing state is the "No projects" screen rather than a
    // canvas — and definitely not a starter conjured to fill the gap.
    await page.waitFor(
      `document.querySelector(".react-flow") !== null || document.body.innerText.includes("No projects")`,
      { label: "the studio again", timeout: 25000 }
    )
    await new Promise((r) => setTimeout(r, 5000))
    const afterReload = await page.evaluate(projectNames)
    check("it did not come back on reload", !afterReload.includes(target), afterReload.join(", "))
    check(
      "and it did not come back as a duplicate",
      afterReload.length === localBefore.length - 1,
      `${afterReload.length} local projects, expected ${localBefore.length - 1}`
    )

    check(
      "the studio says it is empty instead of inventing a project",
      await page.evaluate(`return document.body.innerText.includes("No projects")`)
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
