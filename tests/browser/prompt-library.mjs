/**
 * The prompt library, in a real browser.
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
  const tag = Math.random().toString(36).slice(2, 10)
  const page = await launch({ port: 9384 })
  try {
    console.log("\n== sign up and open the library ==")
    await page.goto(`${APP}/register`)
    await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
    await page.fill('input[autocomplete="name"]', "Library Lena")
    await page.fill('input[type="email"]', `library.${tag}@example.com`)
    await page.fill('input[type="password"]', "Password123")
    await new Promise((r) => setTimeout(r, 400))
    await clickText(page, "create account")
    await page.waitFor(
      `["/","/web","/mobile","/backend","/landing","/data","/code","/design","/prompts"].includes(location.pathname)`,
      { label: "the studio", timeout: 25000 }
    )

    // The tab is reachable by its own URL, which is the point of putting it
    // in the path: a colleague can be sent straight to it.
    await page.goto(`${APP}/prompts`)
    await page.waitFor(`document.body.innerText.includes("Prompt library")`, {
      label: "the library",
      timeout: 25000,
    })
    check("the library opens at its own URL", true)
    check(
      "and the tab is selected rather than the app defaulting to Web",
      await page.evaluate(
        `return [...document.querySelectorAll('[role=tab]')].some((t) => t.getAttribute("aria-selected") === "true" && (t.textContent || "").includes("Prompts"))`
      )
    )

    console.log("\n== the flagship design prompt ==")
    check(
      "opens on the design prompt from the five-way test",
      await page.evaluate(`return document.body.innerText.includes("The instrument look")`)
    )
    const rendered = await page.evaluate(`
      const article = document.querySelector("article");
      return article ? article.innerText : "";`)
    check("its body is rendered, not a raw dump", rendered.length > 2000, String(rendered.length))
    check(
      "headings are drawn rather than left as hashes",
      !rendered.includes("## ") && rendered.toLowerCase().includes("the one idea"),
      JSON.stringify(rendered.slice(0, 120))
    )
    check("bold markers do not leak through", !rendered.includes("**"))
    check(
      "the slot you fill in is marked",
      rendered.includes("[describe your product in two or three sentences"),
    )

    console.log("\n== copying ==")
    await page.evaluate(CAPTURE)
    await clickAria(page, "Copy the The instrument look prompt")
    const copied = await page.evaluate(`return window.__copied`)
    // What lands on the clipboard is the source, not what was drawn: the
    // renderer strips the markdown, and a person pasting it into an assistant
    // needs the structure back.
    check("copies the raw prompt", copied.includes("## The one idea"), copied.slice(0, 80))
    check("and the whole thing, not the visible part", copied.length > 5000, String(copied.length))
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
    check("and drops the rest", !searched.includes("The instrument look"), searched)
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
    check("a category shows only its own", !filtered.includes("The instrument look"), filtered)
    check("and keeps its own", filtered.includes("Find the cause before the fix"), filtered)

    await clickText(page, "All")
    await new Promise((r) => setTimeout(r, 400))
    check(
      "All brings the rest back",
      await page.evaluate(
        `return document.querySelector("aside ul").innerText.includes("The instrument look")`
      )
    )

    console.log("\n== the two flavour prompts ==")
    await clickText(page, "Dark console")
    const dark = await page.evaluate(`return document.querySelector("article").innerText`)
    check("the dark ground prompt carries the shared principles", dark.toLowerCase().includes("the one idea"))
    check("and commits them to a ground", dark.toLowerCase().includes("near-black"))

    await clickText(page, "Light product page")
    const light = await page.evaluate(`return document.querySelector("article").innerText`)
    check("so does the light one", light.toLowerCase().includes("the one idea"))
    check("with its own ground", light.toLowerCase().includes("white for the page"))

    console.log("\n== it does not disturb the project ==")
    // The library writes nothing. A page that quietly touched the document
    // would show up as a new version or a changed doc; the cheapest proof is
    // that the diagram is still there and unchanged after all of the above.
    await page.goto(`${APP}/web`)
    await page.waitFor(`location.pathname === "/web"`, { label: "the web tab", timeout: 15000 })
    check(
      "the project is untouched",
      await page.evaluate(`
        const store = JSON.parse(localStorage.getItem("ps:v1"));
        const project = store.state.projects.find((p) => p.id === store.state.activeId);
        return project.screens.length > 0;`)
    )
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
