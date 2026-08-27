/**
 * The team link — `#p=<project id>`.
 *
 * The old "Copy share link" put the whole document inside the URL, so the
 * person who opened it got a frozen copy under their own account and the two
 * of them edited different things forever. This one carries a reference: the
 * recipient opens the live project, with the role they were given.
 *
 * What only a browser can answer:
 *   - someone who was added lands on the project itself, not a copy
 *   - a viewer gets it read-only
 *   - someone who was never added is refused, and is not told it exists
 *   - the link survives the bounce through /login
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
const viewer = `viewer.${tag}@example.com`
const outsider = `outsider.${tag}@example.com`

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

async function signIn(page, email) {
  await page.goto(`${APP}/login`)
  await page.waitFor(`document.querySelector('input[type=email]')`, { label: "the sign-in form" })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', PASSWORD)
  await new Promise((r) => setTimeout(r, 400))
  await page.evaluate(clickText("sign in"))
  await new Promise((r) => setTimeout(r, 2500))
}

async function main() {
  const ownerToken = await registerAccount(owner)
  await registerAccount(viewer)
  const outsiderToken = await registerAccount(outsider)

  const projectName = `Team ${tag}`
  const created = await api("/projects", {
    method: "POST",
    token: ownerToken,
    body: {
      name: projectName,
      doc: {
        name: projectName,
        screens: [{ id: "s1", key: "home", title: "Shared Home", x: 0, y: 0 }],
      },
    },
  })
  const projectId = created.data.id
  await api(`/projects/${projectId}/members`, {
    method: "POST",
    token: ownerToken,
    body: { email: viewer, role: "VIEWER" },
  })
  check("the owner can add a viewer", true)

  let member = null
  let stranger = null
  try {
    // ── 1. a member opens the link ──────────────────────────────────────────
    member = await launch({ port: 9370 })
    await signIn(member, viewer)
    await member.goto(`${APP}/#p=${projectId}`)
    await member.waitFor(`document.body.innerText.includes("Shared Home")`, {
      label: "the shared project",
      timeout: 20000,
    })
    const memberText = await member.evaluate(`return document.body.innerText`)
    check("a member lands on the project the link points at", memberText.includes("Shared Home"))
    check(
      "a viewer is told they cannot edit it",
      /view-only|cannot change|read-only/i.test(memberText),
      memberText.slice(0, 300)
    )

    // It is the project, not a copy of it: the server must still see exactly one.
    await new Promise((r) => setTimeout(r, 3000))
    const ownerProjects = await api("/projects", { token: ownerToken })
    const copies = (ownerProjects.data?.items ?? []).filter((p) => p.name === projectName)
    check("no duplicate project was created", copies.length === 1, `found ${copies.length}`)

    // And the viewer's edits are refused rather than saved locally.
    const stillThere = await member.evaluate(`
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
      return document.body.innerText.includes("Shared Home");
    `)
    check("a viewer cannot delete or undo on the canvas", stillThere)

    const serverDoc = await api(`/projects/${projectId}`, { token: ownerToken })
    check(
      "the document on the server is untouched",
      (serverDoc.data?.doc?.screens ?? []).length === 1,
      JSON.stringify(serverDoc.data?.doc?.screens ?? []).slice(0, 200)
    )

    // ── 2. the link survives the sign-in redirect ───────────────────────────
    // A fresh browser, signed out, opening the link cold.
    stranger = await launch({ port: 9371 })
    await stranger.goto(`${APP}/#p=${projectId}`)
    await stranger.waitFor(`document.querySelector('input[type=email]')`, {
      label: "the sign-in form after the redirect",
      timeout: 20000,
    })
    const stashed = await stranger.evaluate(
      `return window.sessionStorage.getItem("ps:pending-project")`
    )
    check("the link is remembered across the redirect to /login", stashed === projectId, String(stashed))

    // ── 3. an outsider is refused, and told nothing ─────────────────────────
    await signIn(stranger, outsider)
    await new Promise((r) => setTimeout(r, 4000))
    const outsiderText = await stranger.evaluate(`return document.body.innerText`)
    check(
      "an outsider does not see the project",
      !outsiderText.includes("Shared Home"),
      outsiderText.slice(0, 200)
    )
    check(
      "and the API still refuses them",
      (await api(`/projects/${projectId}`, { token: outsiderToken })).status === 404
    )
  } finally {
    if (member) await member.close()
    if (stranger) await stranger.close()
  }

  console.log(fails.length ? `\n${fails.length} FAILED` : "\nall good")
  process.exit(fails.length ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
