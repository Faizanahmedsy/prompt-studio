/**
 * One person, alone, editing — and never told somebody else got there first.
 *
 * There are two writers for one document: the collaboration socket, and the
 * debounced HTTP push in `use-project-sync`. Both used to fire on every change,
 * so they raced each other on the same project — the socket saved, the server
 * moved to N+1, the HTTP push went out still claiming N, and whichever lost was
 * refused as stale. With nobody else in the room, the person dragging a node
 * was told "someone else had saved a newer version" every few seconds. The
 * someone else was their own other code path.
 *
 * While a socket is open it owns the document and the HTTP push stands down for
 * that project. This asserts that, the only way that means anything: by making
 * a lot of edits quickly and watching for the toast.
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

/** Everything the toaster is showing, so a conflict cannot slip past unseen. */
const toastText = `
  return [...document.querySelectorAll("[data-sonner-toast], [data-sonner-toaster] *")]
    .map((n) => n.textContent || "")
    .join(" | ");`

async function addAScreen(page) {
  const before = await page.evaluate(screenCount)
  await page.evaluate(clickLabelled("Add screen"))
  await page.waitFor(
    `document.querySelector('[data-radix-popper-content-wrapper] button') !== null`,
    { label: "the template picker" }
  )
  await page.evaluate(
    `document.querySelector('[data-radix-popper-content-wrapper] button').click(); return true`
  )
  // Confirmed, not assumed: clicking again while the previous popover is still
  // closing lands on nothing, and the test would then blame the sync layer for
  // a screen the canvas never got.
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    if ((await page.evaluate(screenCount)) === before + 1) return
    await new Promise((r) => setTimeout(r, 150))
  }
  throw new Error(`the screen was never added — still ${before}`)
}

async function main() {
  const tag = Math.random().toString(36).slice(2, 10)
  const page = await launch({ port: 9385 })
  const seen = []

  try {
    console.log("\n== sign up and open the studio ==")
    await page.goto(`${APP}/register`)
    await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
    await page.fill('input[autocomplete="name"]', "Solo Sam")
    await page.fill('input[type="email"]', `solo.${tag}@example.com`)
    await page.fill('input[type="password"]', "Password123")
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(clickLabelled("Create account"))
    await page.waitFor(`["/web","/mobile","/backend","/landing","/data","/code","/design"].includes(location.pathname)`, { label: "the studio", timeout: 25000 })
    await page.waitFor(
      `(() => { try { return Object.keys(JSON.parse(localStorage.getItem("ps:sync")).state.links).length > 0 } catch { return false } })()`,
      { label: "the project linked", timeout: 30000 }
    )

    // The socket has to be open, or this proves nothing — the race needs both
    // writers live.
    await page.waitFor(`document.body.innerText.includes("Synced")`, {
      label: "the socket to connect",
      timeout: 25000,
    })
    check("the socket is open — both writers are live", true)

    console.log("\n== edit repeatedly, faster than the debounce ==")
    const before = await page.evaluate(screenCount)
    for (let index = 0; index < 8; index += 1) {
      await addAScreen(page)
      // Deliberately inside the 400ms socket debounce and the 800ms HTTP one,
      // which is exactly the window the two writers used to collide in.
      await new Promise((r) => setTimeout(r, 250))
      seen.push(await page.evaluate(toastText))
    }

    // Let both debounces drain and anything in flight land.
    await new Promise((r) => setTimeout(r, 4000))
    seen.push(await page.evaluate(toastText))

    const after = await page.evaluate(screenCount)
    check("every edit landed locally", after === before + 8, `${after} vs ${before + 8}`)

    const conflicts = seen.filter((text) => /newer version|Reloaded|conflict/i.test(text))
    check(
      "never told that somebody else saved",
      conflicts.length === 0,
      conflicts.slice(0, 2).join(" || ")
    )

    const badge = await page.evaluate(`return document.body.innerText`)
    check("the badge still reads Synced", badge.includes("Synced"), "not synced after editing")

    console.log("\n== and the server has it ==")
    const token = await page.evaluate(`return localStorage.getItem("prompt-studio.access_token")`)
    const remoteId = await page.evaluate(
      `return Object.values(JSON.parse(localStorage.getItem("ps:sync")).state.links)[0]`
    )
    const api = process.env.API ?? "http://127.0.0.1:8010"
    const saved = await fetch(`${api}/api/v1/projects/${remoteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json())
    check(
      "the server document matches the canvas",
      saved.data?.doc?.screens?.length === after,
      `server ${saved.data?.doc?.screens?.length}, canvas ${after}`
    )

    const noisy = page.consoleErrors.filter(
      (line) => !/Failed to load resource|DevTools|net::/i.test(line)
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
