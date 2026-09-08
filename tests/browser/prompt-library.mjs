/**
 * The prompt library and the landing page, in a real browser — signed out.
 *
 * The point of this file changed when the library became public: the first
 * thing it proves is that a visitor with no account reaches both pages and is
 * never bounced to a login form. Everything after that is the library itself.
 *
 * Unit tests cover the catalogue — that the prompts are whole, that search
 * narrows. What they cannot see is the path a person actually uses: the tab
 * exists, its URL is shareable, the long body renders rather than sitting in a
 * scrollbar, and the Copy button puts the *raw* prompt on the clipboard rather
 * than the drawn version. That last one is the whole point of the page and the
 * one thing a rendering bug would silently break.
 *
 * Clipboard is read by wrapping `writeText`: a headless tab is not focused, so
 * `readText` refuses. Clicks are real mouse events for the same reason as
 * everywhere else in this directory — a control covered by a toast should fail
 * here exactly as it would for a person.
 */
import { launch } from "./cdp.mjs"

const APP = process.env.APP ?? "http://localhost:3002"
const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

const CAPTURE = `
  window.__copied = "";
  const write = navigator.clipboard.writeText.bind(navigator.clipboard);
  navigator.clipboard.writeText = (text) => { window.__copied = text; return write(text).catch(() => {}); };
  return true;`

async function clearToasts(page) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const present = await page.evaluate(
      `return document.querySelectorAll("[data-sonner-toast]").length > 0`
    )
    if (!present) return
    await new Promise((r) => setTimeout(r, 500))
  }
}

async function onPath(page, path) {
  return (await page.evaluate(`return location.pathname`)) === path
}

async function clickText(page, text, selector = "button") {
  await clearToasts(page)
  const box = await page.evaluate(`
    const node = [...document.querySelectorAll(${JSON.stringify(selector)})]
      .find((b) => (b.textContent || "").toLowerCase().includes(${JSON.stringify(text.toLowerCase())}));
    if (!node) throw new Error("nothing matching " + ${JSON.stringify(text)});
    node.scrollIntoView({ block: "center" });
    const r = node.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });`)
  const at = JSON.parse(box)
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", ...at, button: "left", clickCount: 1 })
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...at, button: "left", clickCount: 1 })
  await new Promise((r) => setTimeout(r, 600))
}

/**
 * The top bar carries its own copy button — the one that builds a prompt from
 * the open project — so this one is found by its label rather than its text.
 * The visible labels differ too ("Copy this prompt"), which is the fix for the
 * person looking at the screen; this is the fix for the test.
 */
async function clickAria(page, label) {
  await clearToasts(page)
  const box = await page.evaluate(`
    const node = [...document.querySelectorAll("button")]
      .find((b) => (b.getAttribute("aria-label") || "") === ${JSON.stringify(label)});
    if (!node) throw new Error("no button labelled " + ${JSON.stringify(label)});
    node.scrollIntoView({ block: "center" });
    const r = node.getBoundingClientRect();
    return JSON.stringify({ x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) });`)
  const at = JSON.parse(box)
  await page.send("Input.dispatchMouseEvent", { type: "mousePressed", ...at, button: "left", clickCount: 1 })
  await page.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...at, button: "left", clickCount: 1 })
  await new Promise((r) => setTimeout(r, 600))
}

async function main() {
  const page = await launch({ port: 9384 })
  try {
    console.log("\n== a visitor with no account ==")
    await page.goto(`${APP}/`)
    await page.waitFor(`document.body.innerText.includes("Prompt Studio")`, {
      label: "the landing page",
      timeout: 25000,
    })
    // The studio is behind the login; these two pages are not. A visitor
    // pushed to /login here is the regression this whole file guards.
    check("the landing page opens without an account", await onPath(page, "/"))
    check(
      "it says what the product does",
      await page.evaluate(
        `return document.body.innerText.includes("Draw the app. Get the prompt that builds it.")`
      )
    )
    check(
      "and offers a way in",
      await page.evaluate(
        `return [...document.querySelectorAll("a")].some((a) => a.getAttribute("href") === "/login")`
      )
    )
    check(
      "signed out, it invites you to start rather than to open the studio",
      await page.evaluate(`return document.body.innerText.includes("Start a project")`)
    )

    await clickText(page, "Browse the prompt library", "a")
    await page.waitFor(`location.pathname === "/prompts"`, {
      label: "the library",
      timeout: 20000,
    })
    check("the landing page links straight into the library", true)
    check(
      "which also opens without an account",
      await page.evaluate(`return document.body.innerText.includes("Prompt library")`)
    )
    check(
      "and says so, rather than asking for one",
      !(await page.evaluate(`return document.body.innerText.includes("Sign in")`))
    )

    console.log("\n== the flagship design prompt ==")
    check(
      "opens on the master design brief",
      await page.evaluate(`return document.body.innerText.includes("Master design brief")`)
    )
    const rendered = await page.evaluate(`
      const article = document.querySelector("article");
      return article ? article.innerText : "";`)
    check("its body is rendered, not a raw dump", rendered.length > 2000, String(rendered.length))
    check(
      "headings are drawn rather than left as hashes",
      !rendered.includes("## ") && rendered.toLowerCase().includes("classify, then choose"),
      JSON.stringify(rendered.slice(0, 120))
    )
    check("bold markers do not leak through", !rendered.includes("**"))
    check(
      "nor italics, nor the part headings",
      !rendered.includes("*audience*") && !rendered.includes("# PART 0"),
      JSON.stringify(rendered.slice(rendered.indexOf("PART 0") - 40, rendered.indexOf("PART 0") + 40))
    )
    check(
      "the slot you fill in is marked",
      rendered.includes("[describe your product in two or three sentences")
    )
    check(
      "the monospace rule that broke a school site is stated as a hard rule",
      rendered.includes("MONOSPACE IS OFF BY DEFAULT")
    )
    check(
      "and all eight directions are there to choose between",
      ["EDITORIAL INSTITUTIONAL", "TECHNICAL CONSOLE", "QUIET LUXURY", "EXPRESSIVE APP"].every(
        (name) => rendered.includes(name)
      )
    )

    console.log("\n== copying ==")
    await page.evaluate(CAPTURE)
    await clickAria(page, "Copy the Master design brief prompt")
    const copied = await page.evaluate(`return window.__copied`)
    // What lands on the clipboard is the source, not what was drawn: the
    // renderer strips the markdown, and a person pasting it into an assistant
    // needs the structure back.
    check("copies the raw prompt", copied.includes("## 1.2 Type"), copied.slice(0, 80))
    check("and the whole thing, not the visible part", copied.length > 18000, String(copied.length))
    check(
      "the button says it worked",
      await page.evaluate(`return document.body.innerText.includes("Copied")`)
    )

    // The renderer strips `**` to draw bold, so a prompt that uses it is the
    // one that proves the clipboard gets the source rather than the drawing.
    await clickText(page, "Find the cause before the fix")
    await page.evaluate(CAPTURE)
    await clickAria(page, "Copy the Find the cause before the fix prompt")
    const marked = await page.evaluate(`return window.__copied`)
    check("bold markers survive the copy", marked.includes("**State the symptom precisely.**"), marked.slice(0, 80))
    check(
      "though they were drawn, not shown, on the page",
      !(await page.evaluate(`return document.querySelector("article").innerText.includes("**")`))
    )

    console.log("\n== finding one ==")
    await clearToasts(page)
    await page.fill('input[aria-label="Search prompts"]', "root cause")
    await new Promise((r) => setTimeout(r, 500))
    const searched = await page.evaluate(`
      const list = document.querySelector("aside ul");
      return list ? list.innerText : "EMPTY";`)
    check("search narrows to the match", searched.includes("Find the cause before the fix"), searched)
    check("and drops the rest", !searched.includes("Master design brief"), searched)
    check(
      "the pane follows the search rather than going blank",
      await page.evaluate(
        `return document.querySelector("article").innerText.includes("You do not get to propose a fix")`
      )
    )

    await page.fill('input[aria-label="Search prompts"]', "zzzzqqq")
    await new Promise((r) => setTimeout(r, 400))
    check(
      "a miss says so instead of showing everything",
      await page.evaluate(`return document.body.innerText.includes("Nothing matches")`)
    )

    console.log("\n== filtering ==")
    await page.fill('input[aria-label="Search prompts"]', "")
    await new Promise((r) => setTimeout(r, 400))
    await clickText(page, "Debug")
    await new Promise((r) => setTimeout(r, 400))
    const filtered = await page.evaluate(`
      const list = document.querySelector("aside ul");
      return list ? list.innerText : "EMPTY";`)
    check("a category shows only its own", !filtered.includes("Master design brief"), filtered)
    check("and keeps its own", filtered.includes("Find the cause before the fix"), filtered)

    await clickText(page, "All")
    await new Promise((r) => setTimeout(r, 400))
    check(
      "All brings the rest back",
      await page.evaluate(
        `return document.querySelector("aside ul").innerText.includes("Master design brief")`
      )
    )

    console.log("\n== the other design prompts ==")
    await clickText(page, "Critique a design you already have")
    const critique = await page.evaluate(`return document.querySelector("article").innerText`)
    check("the critique asks about register first", critique.includes("Register."))
    check("and counts the monospace", critique.includes("Monospace."))

    await clickText(page, "Decide what the home screen is")
    const home = await page.evaluate(`return document.querySelector("article").innerText`)
    check("the entry-screen prompt is still here", home.includes("Who opens this?"))

    console.log("\n== and back out to the studio ==")
    // The header is the only route from here into the app. Signed out it
    // points at the login, and the login is where the account wall starts.
    await clickText(page, "Log in", "a")
    await page.waitFor(`location.pathname === "/login"`, { label: "the login", timeout: 20000 })
    check("the library offers a signed-out way into the app", true)

    await page.goto(`${APP}/web`)
    await page.waitFor(`location.pathname === "/login"`, {
      label: "the login wall",
      timeout: 20000,
    })
    check("while the studio itself is still behind the wall", true)

  } finally {
    await page.close()
  }

  console.log(fails.length ? `\n${fails.length} FAILED\n` : "\nALL PASSED\n")
  process.exit(fails.length ? 1 : 0)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
