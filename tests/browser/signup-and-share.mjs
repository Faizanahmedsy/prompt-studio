/**
 * The real end-to-end: a browser signing up, drawing, sharing, and a second
 * browser seeing the edit live.
 */
import { launch } from "./cdp.mjs"

const APP = process.env.APP ?? "http://localhost:3002"
const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

const tag = Math.random().toString(36).slice(2, 10)
const alice = `alice.${tag}@example.com`
const bob = `bob.${tag}@example.com`
const PASSWORD = "Password123"

const clickText = (text) => `
  const target = [...document.querySelectorAll("button, a")]
    .find((node) => node.textContent.trim().toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
  if (!target) throw new Error("no clickable " + ${JSON.stringify(text)});
  target.click();
  return true;
`

async function signUp(page, email, name) {
  await page.goto(`${APP}/register`)
  await page.waitFor(`document.querySelector('input[type=email]')`, { label: "the register form" })
  await page.fill('input[autocomplete="name"]', name)
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', PASSWORD)
  // React needs a tick to see the controlled values before the button enables.
  await new Promise((r) => setTimeout(r, 400))
  const enabled = await page.evaluate(
    `const b = [...document.querySelectorAll("button")].find((n) => n.textContent.includes("Create account")); return b && !b.disabled`
  )
  if (!enabled) throw new Error("the create-account button never enabled")
  await page.evaluate(clickText("create account"))
  await new Promise((r) => setTimeout(r, 1200))
  const complaint = await page.evaluate(
    `const alert = document.querySelector('[role="alert"]'); return alert ? alert.innerText : null`
  )
  if (complaint) throw new Error(`sign-up refused: ${complaint}`)
}

async function main() {
  const one = await launch({ port: 9333 })
  const two = await launch({ port: 9334 })
  try {
    console.log("\n== the app is behind the login ==")
    await one.goto(`${APP}/`)
    await one.waitFor(`location.pathname === "/login"`, { label: "redirect to /login" })
    check("visiting / signed out lands on /login", true)
    await one.waitFor(`document.body.innerText.includes("Sign in")`, { label: "the sign-in form" })
    check("and shows the sign-in form", true)

    console.log("\n== sign up, and the studio opens ==")
    await signUp(one, alice, "Alice A")
    await one.waitFor(`location.pathname === "/"`, { label: "the studio", timeout: 25000 })
    check("registering signs you straight in", true)
    await one.waitFor(`document.querySelector('[data-testid="flow-canvas"], .react-flow') !== null || document.body.innerText.includes("Prompt Studio")`, { label: "the workbench" })
    check(
      "the workbench renders",
      await one.evaluate(`return document.body.innerText.includes("Prompt Studio")`)
    )

    console.log("\n== the project reached the account ==")
    // The sync hook uploads the local starter project, then links it.
    await one.waitFor(
      `(() => { try { const s = JSON.parse(localStorage.getItem("ps:sync")); return s && Object.keys(s.state.links || {}).length > 0 } catch { return false } })()`,
      { label: "a local project linked to a server project", timeout: 30000 }
    )
    const link = await one.evaluate(
      `const s = JSON.parse(localStorage.getItem("ps:sync")); return Object.entries(s.state.links)[0]`
    )
    check("a local project is linked to a server row", Array.isArray(link) && link.length === 2, JSON.stringify(link))
    const remoteId = link[1]

    const token = await one.evaluate(`return localStorage.getItem("prompt-studio.access_token")`)
    check("an access token is stored", Boolean(token))

    console.log("\n== it really is in the database ==")
    const server = await fetch(`http://127.0.0.1:8010/api/v1/projects/${remoteId}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.json())
    check("the API returns the project", server.success === true, JSON.stringify(server).slice(0, 200))
    check(
      "with a document the editor wrote",
      Array.isArray(server.data?.doc?.screens),
      JSON.stringify(server.data?.doc ?? {}).slice(0, 160)
    )

    console.log("\n== sharing by email ==")
    const shared = await fetch(`http://127.0.0.1:8010/api/v1/projects/${remoteId}/members`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ email: bob, role: "EDITOR" }),
    }).then((r) => r.json())
    check("an unregistered address can be added", shared.success === true, JSON.stringify(shared).slice(0, 200))

    console.log("\n== the second person signs up and finds the project ==")
    await signUp(two, bob, "Bob B")
    await two.waitFor(`location.pathname === "/"`, { label: "the studio for the invitee", timeout: 25000 })
    await two.waitFor(
      `(() => { try { const s = JSON.parse(localStorage.getItem("ps:sync")); return Object.values(s.state.links || {}).includes(${JSON.stringify(remoteId)}) } catch { return false } })()`,
      { label: "the shared project pulled down", timeout: 30000 }
    )
    check("the invitation was claimed at sign-up and the project pulled down", true)

    console.log("\n== console health ==")
    // A resource 404 is reported without its URL, so ask the page which
    // requests failed rather than pattern-matching an opaque message.
    const failed = async (page) =>
      page.evaluate(`
        return performance.getEntriesByType("resource")
          .filter((entry) => entry.responseStatus >= 400)
          .map((entry) => entry.name)
      `)
    const brokenRequests = [...(await failed(one)), ...(await failed(two))]
    check("every request the app makes succeeds", brokenRequests.length === 0, brokenRequests.join(" | "))

    const noisy = [...one.consoleErrors, ...two.consoleErrors].filter(
      (line) => !/Download the React DevTools|Extra attributes/i.test(line)
    )
    check("no uncaught errors in either browser", noisy.length === 0, noisy.slice(0, 3).join(" | "))
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
