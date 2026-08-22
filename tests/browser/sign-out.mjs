/**
 * Signing out leaves nothing of that account on the machine.
 *
 * The project store and the sync links persist under fixed keys, so without a
 * teardown they simply outlive the session: sign out, sign in as somebody else,
 * and their editor opens on the previous person's diagrams — read off disk,
 * fully rendered, for a project their address was never added to. That is the
 * one rule this product makes, broken on the client side, which is why it gets
 * a browser test rather than a unit test.
 *
 * Also checks the other half: that pressing "Sign out" actually reaches the
 * server. It used to clear the tokens first, so the request went out with no
 * Authorization header, 401'd, and the refresh token stayed mintable for a
 * month while the person was told they had signed out.
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

const typeInto = (selector, value) => `
  const el = document.querySelector(${JSON.stringify(selector)});
  if (!el) throw new Error("missing " + ${JSON.stringify(selector)});
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  setter.call(el, ${JSON.stringify(value)});
  el.dispatchEvent(new Event("input", { bubbles: true }));
  return true;`

const clickLabelled = (label) => `
  const node = [...document.querySelectorAll("button")]
    .find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim() === ${JSON.stringify(label)});
  if (!node) throw new Error("no button " + ${JSON.stringify(label)});
  node.click();
  return true;`

async function signUp(page, email, name) {
  await page.goto(`${APP}/register`)
  await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
  await page.evaluate(typeInto('input[autocomplete="name"]', name))
  await page.evaluate(typeInto('input[type="email"]', email))
  await page.evaluate(typeInto('input[type="password"]', PASSWORD))
  await new Promise((r) => setTimeout(r, 400))
  await page.evaluate(clickLabelled("Create account"))
  await page.waitFor(`location.pathname === "/"`, { label: `${name} in the studio`, timeout: 25000 })
  await page.waitFor(
    `(() => { try { return Object.keys(JSON.parse(localStorage.getItem("ps:sync")).state.links).length > 0 } catch { return false } })()`,
    { label: `${name}'s project linked`, timeout: 30000 }
  )
}

async function main() {
  const tag = Math.random().toString(36).slice(2, 10)
  const first = `first.${tag}@example.com`
  const second = `second.${tag}@example.com`
  const page = await launch({ port: 9375 })

  try {
    console.log("\n== the first account works and syncs ==")
    await signUp(page, first, "First Person")
    const before = await page.evaluate(`
      const store = JSON.parse(localStorage.getItem("ps:v1"));
      return { projects: store.state.projects.length, names: store.state.projects.map((p) => p.name) };`)
    check("the first account has projects on disk", before.projects > 0, JSON.stringify(before))

    // Renamed so the leak, if any, is unmistakable rather than a starter
    // template the second account would have created for itself anyway.
    const secret = `SECRET-${tag}`
    await page.evaluate(`
      const store = JSON.parse(localStorage.getItem("ps:v1"));
      store.state.projects[0].name = ${JSON.stringify(secret)};
      localStorage.setItem("ps:v1", JSON.stringify(store));
      return true;`)

    const refreshToken = await page.evaluate(
      `return localStorage.getItem("prompt-studio.refresh_token")`
    )
    check("a refresh token is stored", Boolean(refreshToken))

    console.log("\n== sign out ==")
    await page.goto(`${APP}/`)
    await page.waitFor(`document.querySelector('[aria-label="Your account"]') !== null`, {
      label: "the account menu",
      timeout: 25000,
    })
    // A Radix dropdown trigger opens on pointerdown, not on a bare `.click()`.
    await page.evaluate(`
      const trigger = [...document.querySelectorAll("button")]
        .find((b) => b.getAttribute("aria-label") === "Your account");
      if (!trigger) throw new Error("no account menu");
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
        trigger.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0 }));
      }
      return true;`)
    await page.waitFor(
      `[...document.querySelectorAll('[data-radix-popper-content-wrapper] *')]
         .some((n) => n.textContent.trim() === "Sign out")`,
      { label: "the sign-out item" }
    )
    await page.evaluate(`
      const item = [...document.querySelectorAll('[data-radix-popper-content-wrapper] *')]
        .find((n) => n.textContent.trim() === "Sign out");
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
        item.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0 }));
      }
      return true;`)
    await page.waitFor(`location.pathname === "/login"`, { label: "the login screen", timeout: 20000 })
    check("signing out lands on /login", true)

    console.log("\n== nothing of that account is left behind ==")
    await new Promise((r) => setTimeout(r, 1200))
    const after = await page.evaluate(`
      const raw = localStorage.getItem("ps:v1");
      const sync = localStorage.getItem("ps:sync");
      return {
        projects: raw ? (JSON.parse(raw).state.projects || []).length : 0,
        links: sync ? Object.keys(JSON.parse(sync).state.links || {}).length : 0,
        access: localStorage.getItem("prompt-studio.access_token"),
        refresh: localStorage.getItem("prompt-studio.refresh_token"),
        mentionsSecret: (localStorage.getItem("ps:v1") || "").includes(${JSON.stringify(secret)}),
      };`)
    check("the projects are gone from disk", after.projects === 0, JSON.stringify(after))
    check("the sync links are gone", after.links === 0, JSON.stringify(after))
    check("the tokens are gone", !after.access && !after.refresh, JSON.stringify(after))
    check("the previous project's name is nowhere in storage", after.mentionsSecret === false)

    console.log("\n== and the server session really ended ==")
    const replay = await fetch(`${API}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    check(
      "the refresh token no longer mints a session",
      replay.status === 401,
      `got ${replay.status} — the sign-out never reached the server`
    )

    console.log("\n== a second account sees only its own work ==")
    await signUp(page, second, "Second Person")
    const theirs = await page.evaluate(`
      const store = JSON.parse(localStorage.getItem("ps:v1"));
      return store.state.projects.map((p) => p.name);`)
    check(
      "the second account cannot see the first's project",
      !theirs.includes(secret),
      JSON.stringify(theirs)
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
