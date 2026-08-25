/**
 * Two real browsers, one project, edits crossing between them.
 *
 * The point of the whole feature, and the one thing no API test can prove: that
 * what someone draws in one window appears in another window belonging to a
 * different account.
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

const clickLabelled = (label) => `
  const node = [...document.querySelectorAll("button")]
    .find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim() === ${JSON.stringify(label)});
  if (!node) throw new Error("no button " + ${JSON.stringify(label)});
  node.click();
  return true;`

/** `waitFor` takes an expression; this body has statements, so poll it instead. */
async function waitForCount(page, want, { timeout = 25000, label = "" } = {}) {
  const deadline = Date.now() + timeout
  let last = null
  while (Date.now() < deadline) {
    last = await page.evaluate(screenCount)
    if (last === want) return last
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error(`${label}: screen count settled at ${last}, wanted ${want}`)
}

/**
 * Toast text currently on screen.
 *
 * Sonner renders into a region and removes the node when the toast expires, so
 * this has to be read while it is up rather than afterwards.
 */
const toastText = `
  return [...document.querySelectorAll("[data-sonner-toast]")]
    .map((node) => node.innerText.replace(/\\s+/g, " ").trim());`

async function toastsMatching(page, pattern) {
  const seen = await page.evaluate(toastText)
  return seen.filter((line) => pattern.test(line))
}

async function waitForToast(page, pattern, { timeout = 20000 } = {}) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const [first] = await toastsMatching(page, pattern)
    if (first) return first
    await new Promise((r) => setTimeout(r, 150))
  }
  return null
}

const screenCount = `
  const store = JSON.parse(localStorage.getItem("ps:v1"));
  const project = store.state.projects.find((p) => p.id === store.state.activeId);
  return project ? project.screens.length : -1;`

async function signUp(page, email, name) {
  await page.goto(`${APP}/register`)
  await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
  await page.fill('input[autocomplete="name"]', name)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', PASSWORD)
  await new Promise((r) => setTimeout(r, 400))
  await page.evaluate(clickLabelled("Create account"))
  await page.waitFor(`location.pathname === "/"`, { label: `${name} in the studio`, timeout: 25000 })
  await page.waitFor(
    `(() => { try { return Object.keys(JSON.parse(localStorage.getItem("ps:sync")).state.links).length > 0 } catch { return false } })()`,
    { label: `${name}'s projects linked`, timeout: 30000 }
  )
}

async function main() {
  const tag = Math.random().toString(36).slice(2, 10)
  const alice = `alice.${tag}@example.com`
  const bob = `bob.${tag}@example.com`

  const one = await launch({ port: 9350 })
  const two = await launch({ port: 9351 })
  try {
    console.log("\n== two accounts, one shared project ==")
    await signUp(one, alice, "Alice A")
    const [, remoteId] = await one.evaluate(
      `return Object.entries(JSON.parse(localStorage.getItem("ps:sync")).state.links)[0]`
    )
    const token = await one.evaluate(`return localStorage.getItem("prompt-studio.access_token")`)

    const shared = await fetch(`${API}/api/v1/projects/${remoteId}/members`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ email: bob, role: "EDITOR" }),
    }).then((r) => r.json())
    check("shared with the second address", shared.success === true, JSON.stringify(shared).slice(0, 160))

    await signUp(two, bob, "Bob B")
    // Bob has his own starter project as well; point him at the shared one.
    // Switching projects is the project menu's job and is not what this test is
    // about, so it is done through the store the menu writes to.
    await two.evaluate(`
      const sync = JSON.parse(localStorage.getItem("ps:sync"));
      const localId = Object.entries(sync.state.links).find(([, remote]) => remote === ${JSON.stringify(remoteId)})[0];
      const store = JSON.parse(localStorage.getItem("ps:v1"));
      store.state.activeId = localId;
      localStorage.setItem("ps:v1", JSON.stringify(store));
      return localId;`)
    await two.goto(`${APP}/`)
    await two.waitFor(`document.querySelector(".react-flow") !== null`, { label: "Bob's canvas", timeout: 25000 })

    const before = await two.evaluate(screenCount)
    check("both browsers are on the same project", before > 0, `bob sees ${before} screens`)

    console.log("\n== the socket is live in both ==")
    // "Synced" only renders once the websocket is open.
    for (const [name, page] of [["Alice", one], ["Bob", two]]) {
      await page.waitFor(
        `document.body.innerText.includes("Synced") || document.querySelector('[aria-label="Share"]') !== null`,
        { label: `${name}'s toolbar`, timeout: 20000 }
      )
    }
    await new Promise((r) => setTimeout(r, 2500))
    const presence = await two.evaluate(
      `return document.body.innerHTML.includes("border-background")`
    )
    check("the second browser shows an avatar for the first", presence, "no presence stack rendered")

    console.log("\n== an edit crosses between the two ==")
    const storedVersionBefore = await fetch(`${API}/api/v1/projects/${remoteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((body) => body.data.doc_version)
    const aliceBefore = await one.evaluate(screenCount)
    // "Add screen" opens a template menu; the screen appears when one is picked.
    await one.evaluate(clickLabelled("Add screen"))
    // It is a Radix popover of plain buttons, not a menu with menuitem roles.
    await one.waitFor(
      `document.querySelector('[data-radix-popper-content-wrapper] button') !== null`,
      { label: "the template picker" }
    )
    await one.evaluate(`
      const item = document.querySelector('[data-radix-popper-content-wrapper] button');
      item.click();
      return item.textContent;`)
    await waitForCount(one, aliceBefore + 1, { label: "Alice's own canvas", timeout: 10000 })
    check("the first browser added a screen", true)

    await waitForCount(two, before + 1, { label: "the second browser", timeout: 30000 })
    check("the second browser received it live", true)

    console.log("\n== and the right person is credited ==")
    // The toast names whoever made the change. Bob should see Alice's name.
    const bobToast = await waitForToast(two, /Alice/)
    check("the watcher is told who changed it", Boolean(bobToast), `toast said: ${bobToast ?? "nothing"}`)

    // And the regression that made this worth testing at all: applying a
    // colleague's document used to fire the outbound effect, so the watching
    // tab sent the edit straight back and the server stamped it with *that*
    // tab's user. Alice made this change; nothing may tell her Bob did.
    // Polled rather than slept-then-read: the toast lives for two seconds, so
    // sleeping past it and looking afterwards finds an empty region either way
    // and the check passes whether or not the bug is present.
    const aliceToldBob = await waitForToast(one, /Bob/, { timeout: 6000 })
    check(
      "the editor is not told a colleague made her own change",
      aliceToldBob === null,
      aliceToldBob ?? ""
    )

    // The echo also cost a save per watching tab. One edit, one version.
    const afterEdit = await fetch(`${API}/api/v1/projects/${remoteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json())
    check(
      "one edit produced one version, not one per open tab",
      afterEdit.data.doc_version === storedVersionBefore + 1,
      `version went ${storedVersionBefore} -> ${afterEdit.data.doc_version}`
    )

    console.log("\n== and it is what the database holds ==")
    const stored = await fetch(`${API}/api/v1/projects/${remoteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json())
    check(
      "the server has the new screen too",
      stored.data.doc.screens.length === before + 1,
      `server has ${stored.data.doc.screens.length}, expected ${before + 1}`
    )

    console.log("\n== console health ==")
    const failedRequests = async (page) =>
      page.evaluate(`
        return performance.getEntriesByType("resource")
          .filter((e) => e.responseStatus >= 400)
          .map((e) => e.name)`)
    const broken = [...(await failedRequests(one)), ...(await failedRequests(two))]
    check("no failed requests", broken.length === 0, broken.join(" | "))
    const noisy = [...one.consoleErrors, ...two.consoleErrors].filter(
      (line) => !/Download the React DevTools|Extra attributes/i.test(line)
    )
    check("no uncaught errors", noisy.length === 0, noisy.slice(0, 2).join(" | "))
  } finally {
    await one.close()
    await two.close()
  }

  console.log(`\n${fails.length ? `${fails.length} FAILED: ${fails.join(", ")}` : "ALL PASSED"}`)
  process.exit(fails.length ? 1 : 0)
}

main().catch((error) => {
  console.error("driver failed:", error.message)
  process.exit(2)
})
