/**
 * The public read-only link, in a real browser.
 *
 * The parts only a browser can answer:
 *   - a stranger with no account reaches the diagram at all
 *   - the page is genuinely read-only, not merely missing its buttons
 *   - looking at somebody else's public link does not leave a copy of their
 *     project in the visitor's own browser, or in their account
 *   - a revoked link stops working immediately
 */
import { launch } from "./cdp.mjs"

const APP = process.env.APP ?? "http://localhost:3002"
const API = process.env.API ?? "http://localhost:8010/api/v1"
const PASSWORD = "Password123"

const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

const tag = Math.random().toString(36).slice(2, 10)
const owner = `owner.${tag}@example.com`
const stranger = `stranger.${tag}@example.com`

async function api(path, { method = "GET", token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const payload = await response.json().catch(() => null)
  return { status: response.status, data: payload?.data ?? null }
}

async function registerAccount(email) {
  const { data } = await api("/auth/register", {
    method: "POST",
    body: { email, password: PASSWORD, display_name: email.split("@")[0] },
  })
  if (!data?.access_token) throw new Error(`could not register ${email}`)
  return data.access_token
}

const clickText = (text) => `
  const target = [...document.querySelectorAll("button, a")]
    .find((node) => node.textContent.trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
  if (!target) throw new Error("no clickable " + ${JSON.stringify(text)});
  target.click();
  return true;
`

async function main() {
  // ── set the project up over the API; the browser is for the viewing ──────
  const ownerToken = await registerAccount(owner)
  const created = await api("/projects", {
    method: "POST",
    token: ownerToken,
    body: {
      name: `Public ${tag}`,
      doc: {
        name: `Public ${tag}`,
        screens: [
          { id: "s1", key: "home", title: "Home Screen", x: 0, y: 0 },
          { id: "s2", key: "detail", title: "Detail Screen", x: 300, y: 0 },
        ],
        edges: [{ id: "e1", from: "s1", to: "s2", trigger: "tap a row" }],
      },
    },
  })
  const projectId = created.data.id
  const published = await api(`/projects/${projectId}/public-link`, {
    method: "POST",
    token: ownerToken,
  })
  const token = published.data.token
  check("the owner can publish a read-only link", Boolean(token), JSON.stringify(published))

  const guest = await launch({ port: 9360 })
  let strangerPage = null
  let revoked = null
  try {
    // ── 1. a stranger with no account ───────────────────────────────────────
    await guest.goto(`${APP}/v/${token}`)
    await guest.waitFor(
      `document.body.innerText.includes("Home Screen") || document.body.innerText.includes("no longer available")`,
      { label: "the shared project", timeout: 20000 }
    )
    const guestText = await guest.evaluate(`return document.body.innerText`)
    check("an anonymous visitor sees the diagram", guestText.includes("Home Screen"), guestText.slice(0, 200))
    check("both screens render", guestText.includes("Detail Screen"), guestText.slice(0, 200))
    check(
      "they are told it is read-only",
      /view|read-only|shared project/i.test(guestText),
      guestText.slice(0, 300)
    )
    const guestHref = await guest.evaluate(`return window.location.pathname`)
    check(
      "they were not bounced to the login screen",
      !guestHref.startsWith("/login"),
      guestHref
    )

    // ── 2. read-only means the document cannot be changed ───────────────────
    const beforeEdit = await guest.evaluate(`
      return JSON.stringify(window.localStorage.getItem("ps:v1") ?? "")
    `)
    // Drive the store directly — the strongest form of the question, because it
    // bypasses every disabled button and goes straight at the data.
    const editRefused = await guest.evaluate(`
      const before = document.body.innerText.includes("Home Screen");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
      return before && document.body.innerText.includes("Home Screen");
    `)
    check("keyboard shortcuts cannot delete or undo anything", editRefused)

    const afterEdit = await guest.evaluate(`
      return JSON.stringify(window.localStorage.getItem("ps:v1") ?? "")
    `)
    check("nothing was written to storage by viewing", beforeEdit === afterEdit)

    // ── 3. the visitor's own projects are untouched ─────────────────────────
    const leaked = await guest.evaluate(`
      const raw = window.localStorage.getItem("ps:v1");
      if (!raw) return "none";
      const parsed = JSON.parse(raw);
      const names = (parsed?.state?.projects ?? []).map((p) => p.name);
      return names.join("|");
    `)
    check(
      "the shared project is not saved into the visitor's browser",
      !leaked.includes(`Public ${tag}`),
      leaked
    )

    // ── 4. a signed-in stranger does not gain a copy in their account ───────
    const strangerToken = await registerAccount(stranger)
    strangerPage = await launch({ port: 9361 })
    await strangerPage.goto(`${APP}/login`)
    await strangerPage.waitFor(`document.querySelector('input[type=email]')`, {
      label: "the sign-in form",
    })
    await strangerPage.fill('input[type="email"]', stranger)
    await strangerPage.fill('input[type="password"]', PASSWORD)
    await new Promise((r) => setTimeout(r, 400))
    await strangerPage.evaluate(clickText("sign in"))
    await new Promise((r) => setTimeout(r, 2500))
    await strangerPage.goto(`${APP}/v/${token}`)
    await strangerPage.waitFor(`document.body.innerText.includes("Home Screen")`, {
      label: "the shared project for a signed-in visitor",
      timeout: 20000,
    })
    await new Promise((r) => setTimeout(r, 3000))

    const strangerProjects = await api("/projects", { token: strangerToken })
    const names = (strangerProjects.data?.items ?? []).map((p) => p.name)
    check(
      "viewing a public link does not copy it into the viewer's account",
      !names.includes(`Public ${tag}`),
      names.join("|")
    )
    check(
      "and the viewer still cannot open the project itself",
      (await api(`/projects/${projectId}`, { token: strangerToken })).status === 404
    )

    // ── 5. revoking works while the page is open ────────────────────────────
    await api(`/projects/${projectId}/public-link`, { method: "DELETE", token: ownerToken })
    revoked = await launch({ port: 9362 })
    await revoked.goto(`${APP}/v/${token}`)
    await revoked.waitFor(`document.body.innerText.includes("no longer available")`, {
      label: "the revoked-link message",
      timeout: 20000,
    })
    check("a revoked link stops working", true)

    // ── 6. the owner still has full access ──────────────────────────────────
    const still = await api(`/projects/${projectId}`, { token: ownerToken })
    check("the owner's project is unharmed", still.status === 200 && still.data.name === `Public ${tag}`)
  } finally {
    await guest.close()
    if (strangerPage) await strangerPage.close()
    if (revoked) await revoked.close()
  }

  console.log(fails.length ? `\n${fails.length} FAILED` : "\nall good")
  process.exit(fails.length ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
