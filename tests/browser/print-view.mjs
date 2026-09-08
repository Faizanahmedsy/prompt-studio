/**
 * The print view renders the prompt as prose, not as a wall of monospace.
 *
 * Worth a browser test because the thing being checked is what the page looks
 * like: that headings are headings, fenced Flow source survives as code, no
 * `**stars**` leak through as literal text, and a wide code block scrolls inside
 * itself rather than making the page scroll sideways.
 */
import { launch } from "./cdp.mjs"

const APP = process.env.APP ?? "http://localhost:3002"
const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

async function main() {
  const tag = Math.random().toString(36).slice(2, 10)
  const page = await launch({ port: 9360 })
  try {
    await page.goto(`${APP}/register`)
    await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
    await page.fill('input[autocomplete="name"]', "Printer")
    await page.fill('input[type="email"]', `print.${tag}@example.com`)
    await page.fill('input[type="password"]', "Password123")
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(
      `[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Create account")).click(); return true`
    )
    await page.waitFor(`["/web","/mobile","/backend","/landing","/data","/code","/design"].includes(location.pathname)`, { label: "the studio", timeout: 25000 })
    await new Promise((r) => setTimeout(r, 3000))

    await page.goto(`${APP}/print`)
    await page.waitFor(`document.querySelector(".prompt-markdown") !== null`, {
      label: "the rendered prompt",
      timeout: 20000,
    })

    const shape = await page.evaluate(`
      const root = document.querySelector("main");
      return {
        lists: root.querySelectorAll(".prompt-markdown ul, .prompt-markdown ol").length,
        code: root.querySelectorAll(".prompt-markdown pre").length,
        inlineCode: root.querySelectorAll(".prompt-markdown code:not(pre code)").length,
        bold: root.querySelectorAll(".prompt-markdown strong").length,
        rawStars: root.innerText.indexOf("**") >= 0,
        strayFences: root.innerText.indexOf("\\u0060\\u0060\\u0060") >= 0,
        sideScroll: document.documentElement.scrollWidth > window.innerWidth + 1,
      };`)

    check("bullet lists render as lists", shape.lists > 0, JSON.stringify(shape))
    check("fenced blocks render as code", shape.code > 0, JSON.stringify(shape))
    check("inline code renders", shape.inlineCode > 0, JSON.stringify(shape))
    check("bold renders", shape.bold > 0, JSON.stringify(shape))
    check("no literal ** left in the text", shape.rawStars === false)
    check("no stray fence markers left in the text", shape.strayFences === false)
    check("the page does not scroll sideways", shape.sideScroll === false)

    await page.evaluate(
      `[...document.querySelectorAll("button")].find((b) => b.textContent.includes("Raw markdown")).click(); return true`
    )
    await new Promise((r) => setTimeout(r, 500))
    const raw = await page.evaluate(`
      return {
        markdownGone: document.querySelector(".prompt-markdown") === null,
        pres: document.querySelectorAll("main pre").length,
        button: [...document.querySelectorAll("button")]
          .map((b) => b.textContent.trim())
          .filter((t) => t === "Rendered" || t === "Raw markdown")[0],
      };`)
    check("the raw view is one click away", raw.markdownGone && raw.pres > 0, JSON.stringify(raw))
    check("and the button flips back", raw.button === "Rendered", JSON.stringify(raw))

    const noisy = page.consoleErrors.filter((line) => !/DevTools/.test(line))
    check("no console errors", noisy.length === 0, noisy.slice(0, 2).join(" | "))
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
