/**
 * A project that ships three builds, driven through the real UI.
 *
 * The unit tests prove the prompt composes; this proves a person can actually
 * get there — choose the builds when creating the project, see the backend
 * technology asked for, and find one prompt describing the whole system rather
 * than whichever tab happened to be open.
 */
import { launch } from "./cdp.mjs"

const APP = process.env.APP ?? "http://localhost:3002"
const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

/**
 * Click inside the open dialog only.
 *
 * The top bar has its own Web / Mobile / Backend tabs, and a document-wide
 * search for "Backend" finds that tab long before it finds the dialog's build
 * button — so the test switched tabs and reported that the toggle did nothing.
 */
const clickInDialog = (text) => `
  const dialog = document.querySelector("[role=dialog]");
  if (!dialog) throw new Error("no dialog open");
  const node = [...dialog.querySelectorAll("button")]
    .find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().startsWith(${JSON.stringify(text)}));
  if (!node) throw new Error("no control " + ${JSON.stringify(text)} + " in the dialog");
  node.click();
  return true;`

const clickText = (text) => `
  const node = [...document.querySelectorAll("button, [role=menuitem]")]
    .find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().startsWith(${JSON.stringify(text)}));
  if (!node) throw new Error("no control " + ${JSON.stringify(text)});
  node.click();
  return true;`

const openProjectMenu = `
  const trigger = [...document.querySelectorAll("button")]
    .find((b) => b.getAttribute("aria-haspopup") === "menu");
  for (const type of ["pointerdown","mousedown","pointerup","mouseup","click"]) {
    trigger.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true }));
  }
  return true;`

async function main() {
  const tag = Math.random().toString(36).slice(2, 10)
  const page = await launch({ port: 9370 })
  try {
    console.log("\n== sign up ==")
    await page.goto(`${APP}/register`)
    await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
    await page.fill('input[autocomplete="name"]', "Builder B")
    await page.fill('input[type="email"]', `builder.${tag}@example.com`)
    await page.fill('input[type="password"]', "Password123")
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(clickText("Create account"))
    await page.waitFor(`location.pathname === "/"`, { label: "the studio", timeout: 25000 })
    await page.waitFor(`document.querySelector(".react-flow") !== null`, {
      label: "the canvas",
      timeout: 25000,
    })
    await new Promise((r) => setTimeout(r, 2500))

    console.log("\n== create a project that ships three builds ==")
    await page.evaluate(openProjectMenu)
    await page.waitFor(`document.querySelector('[role=menu]') !== null`, { label: "the menu" })
    await page.evaluate(clickText("New project"))
    // Section labels render uppercased by CSS, and `innerText` returns the
    // transformed text — so this compares case-insensitively rather than
    // against the case in the source.
    await page.waitFor(
      `/builds/i.test(document.body.innerText) && /start from/i.test(document.body.innerText)`,
      { label: "the new-project dialog" }
    )

    const askedForBuilds = await page.evaluate(
      `const d = document.querySelector("[role=dialog]").innerText; return /mobile/i.test(d) && /backend/i.test(d)`
    )
    check("the dialog asks which builds this product ships", askedForBuilds)

    // Turning the service on has to reveal the service questions — that is the
    // whole point of asking here rather than in a panel nobody opens.
    const beforeBackend = await page.evaluate(`const d = document.querySelector("[role=dialog]"); return d ? /data access/i.test(d.innerText) : false`)
    await page.evaluate(clickInDialog("Backend"))
    await page.evaluate(clickInDialog("Mobile"))
    await new Promise((r) => setTimeout(r, 500))
    const afterBackend = await page.evaluate(`const d = document.querySelector("[role=dialog]"); return d ? /data access/i.test(d.innerText) : false`)
    check("choosing a backend asks what it is built with", !beforeBackend && afterBackend)

    const namesDatabases = await page.evaluate(`const d = document.querySelector("[role=dialog]"); return d ? /api style/i.test(d.innerText) : false`)
    check("and how the clients get their types", namesDatabases)

    await page.evaluate(clickInDialog("Create project"))
    await new Promise((r) => setTimeout(r, 2500))

    const builds = await page.evaluate(`
      const store = JSON.parse(localStorage.getItem("ps:v1"));
      const project = store.state.projects.find((p) => p.id === store.state.activeId);
      return project.builds;`)
    check(
      "the project remembers all three",
      builds.web && builds.mobile && builds.backend,
      JSON.stringify(builds)
    )

    const backendStack = await page.evaluate(`
      const store = JSON.parse(localStorage.getItem("ps:v1"));
      const project = store.state.projects.find((p) => p.id === store.state.activeId);
      return project.surfaces.backend.stack;`)
    check(
      "and what the service is built with",
      Boolean(backendStack.framework && backendStack.database && backendStack.orm),
      JSON.stringify(backendStack).slice(0, 140)
    )

    console.log("\n== the prompt covers the whole system ==")
    await new Promise((r) => setTimeout(r, 2000))
    const promptText = await page.evaluate(`
      return [...document.querySelectorAll("pre.code-surface")].map((n) => n.innerText).join("\\n")`)
    check("it describes one repository", promptText.includes("packages/shared"), promptText.slice(0, 160))
    check("it names each build's folder", promptText.includes("services/api"))
    check(
      "it says how the builds are wired together",
      promptText.includes("Build the service first") || promptText.includes("contract"),
    )

    const scopeSwitch = await page.evaluate(
      `return /whole project/i.test(document.body.innerText)`
    )
    check("and offers a single build for anyone working on one", scopeSwitch)

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
