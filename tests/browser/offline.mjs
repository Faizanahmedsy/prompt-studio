/**
 * The editor keeps working when the API does not.
 *
 * The README promises this in as many words — "with the API down it degrades to
 * exactly what it was before: a browser-only tool" — and a promise nobody tests
 * is a promise that quietly stops being true. So: sign in, then cut the network
 * to the API at the browser level and check the canvas still edits, the work
 * still persists across a reload, and nothing throws.
 *
 * The API is blocked with CDP request interception rather than by stopping the
 * server, so this test cannot disturb anything else running on the machine.
 */
import { launch } from "./cdp.mjs"

const APP = process.env.APP ?? "http://localhost:3002"
const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

const clickLabelled = (label) => `
  const node = [...document.querySelectorAll("button")]
    .find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim() === ${JSON.stringify(label)});
  if (!node) throw new Error("no button " + ${JSON.stringify(label)});
  node.click();
  return true;`

const screenCount = `
  const store = JSON.parse(localStorage.getItem("ps:v1"));
  const project = store.state.projects.find((p) => p.id === store.state.activeId);
  return project ? project.screens.length : -1;`

async function waitForCount(page, want, { timeout = 15000, label = "" } = {}) {
  const deadline = Date.now() + timeout
  let last = null
  while (Date.now() < deadline) {
    last = await page.evaluate(screenCount)
    if (last === want) return last
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`${label}: screen count settled at ${last}, wanted ${want}`)
}

async function addAScreen(page) {
  await page.evaluate(clickLabelled("Add screen"))
  await page.waitFor(
    `document.querySelector('[data-radix-popper-content-wrapper] button') !== null`,
    { label: "the template picker" }
  )
  await page.evaluate(
    `document.querySelector('[data-radix-popper-content-wrapper] button').click(); return true`
  )
}

async function main() {
  const tag = Math.random().toString(36).slice(2, 10)
  const page = await launch({ port: 9370 })
  try {
    console.log("\n== sign in while the API is up ==")
    await page.goto(`${APP}/register`)
    await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
    await page.fill('input[autocomplete="name"]', "Offline Olive")
    await page.fill('input[type="email"]', `offline.${tag}@example.com`)
    await page.fill('input[type="password"]', "Password123")
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(clickLabelled("Create account"))
    await page.waitFor(`["/web","/mobile","/backend","/landing","/data","/code","/design"].includes(location.pathname)`, { label: "the studio", timeout: 25000 })
    await page.waitFor(
      `(() => { try { return Object.keys(JSON.parse(localStorage.getItem("ps:sync")).state.links).length > 0 } catch { return false } })()`,
      { label: "the project linked to the account", timeout: 30000 }
    )
    check("signed in and synced", true)

    console.log("\n== now cut the API off ==")
    await page.send("Network.enable")
    await page.send("Network.setBlockedURLs", { urls: ["*8010*"] })
    // Also stop the socket reconnecting into a working server.
    await page.goto(`${APP}/web`)
    await page.waitFor(`document.querySelector(".react-flow") !== null`, {
      label: "the canvas, with no API",
      timeout: 25000,
    })
    check("the studio still loads with the API unreachable", true)

    const before = await page.evaluate(screenCount)
    check("the project is still there", before > 0, `screens: ${before}`)

    console.log("\n== and it still edits ==")
    await addAScreen(page)
    await waitForCount(page, before + 1, { label: "editing offline" })
    check("a screen can still be added", true)

    await page.evaluate(clickLabelled("Undo"))
    await waitForCount(page, before, { label: "undo offline" })
    check("undo still works", true)

    await addAScreen(page)
    await waitForCount(page, before + 1, { label: "re-adding" })

    console.log("\n== and it survives a reload ==")
    await page.goto(`${APP}/web`)
    await page.waitFor(`document.querySelector(".react-flow") !== null`, {
      label: "the canvas after reload",
      timeout: 25000,
    })
    const after = await page.evaluate(screenCount)
    check("the offline edit survived a reload", after === before + 1, `${after} vs ${before + 1}`)

    console.log("\n== and it says so, rather than pretending ==")
    const told = await page.evaluate(`
      const text = document.body.innerText;
      return text.includes("Offline") || text.includes("Connecting") || text.includes("offline");`)
    check("the toolbar admits it is offline", told, "no offline indication rendered")

    console.log("\n== nothing threw ==")
    // A blocked request is reported as a failure by the page; that is the point
    // of the test, so those are filtered out and everything else is not.
    const noisy = page.consoleErrors.filter(
      (line) => !/Failed to load resource|DevTools|ERR_BLOCKED|net::/i.test(line)
    )
    check("no uncaught errors", noisy.length === 0, noisy.slice(0, 3).join(" | "))
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
