/**
 * Journeys and stories, exercised the way somebody actually meets them.
 *
 * The unit tests already prove the grammar round-trips and the prompt renders.
 * What they cannot show is the part that only exists in a browser: that pasting
 * a Flow file from a model puts journeys on the canvas, that picking one
 * filters the diagram to it and opens its story, and that the story a person
 * types into the inspector reaches the generated prompt.
 *
 * The paste is the important half. Stories are not meant to be typed into
 * ninety-six inspectors — they arrive with the file, written by the model that
 * drew the diagram. This asserts that path first.
 */
import { launch } from "./cdp.mjs"

const APP = process.env.APP ?? "http://localhost:3002"
const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

/** A file of exactly the shape "New flow from requirements" now asks for. */
const PASTED = `app "Journeys Under Test" {
  target claude-code
  creativity 5
}

flows {
  flow auth "Authentication" {
    story {
      as     "a returning user"
      want   "get back in without contacting support"
      so     "I am not blocked for a day"
      accept [
        "a reset link expires 30 minutes after it is issued"
        "a wrong password does not reveal whether the address exists"
      ]
    }
  }
  flow billing "Billing" {
    story {
      as     "an account owner"
      want   "see what we are paying and change the plan"
      so     "finance does not have to raise a ticket"
      accept [ "downgrading states what is lost before it applies" ]
    }
  }
}

screen login "Sign In" {
  template auth
  layout   auth-split
  flows    [auth]
  story {
    as     "a signed-out user"
    want   "sign in with my email and password"
    so     "I can reach my work"
    accept [ "the submit button is disabled until both fields are filled" ]
  }
}

screen reset "Reset Password" { template auth; layout auth-center; flows [auth] }

screen plans "Plans" {
  template settings
  layout   settings-sections
  flows    [billing]
  story {
    as     "an account owner"
    want   "compare the plans side by side"
    so     "I can tell which one we actually need"
  }
}

screen invoices "Invoices" { template table; layout table-basic; flows [billing] }

flow {
  login  -> reset    : "click Forgot password"
  reset  -> login    : "on password changed"
  login  -> plans    : "open Billing"
  plans  -> invoices : "click Invoices"
}
`

const activeDoc = `
  const store = JSON.parse(localStorage.getItem("ps:v1"));
  return store.state.projects.find((p) => p.id === store.state.activeId) ?? null;`

/** Every button on the page, so a label change fails loudly rather than silently. */
const clickText = (text) => `
  const node = [...document.querySelectorAll("button")]
    .find((b) => (b.textContent || "").trim().includes(${JSON.stringify(text)}));
  if (!node) throw new Error("no button containing " + ${JSON.stringify(text)});
  node.click();
  return true;`

/**
 * Radix menus open on `pointerdown`, not on `click` — a plain `.click()` leaves
 * the trigger looking pressed and no menu on the page, which reads as "the
 * control is broken" rather than "the test used the wrong event".
 */
const openMenu = (text) => `
  const node = [...document.querySelectorAll("button")]
    .find((b) => (b.textContent || "").trim().includes(${JSON.stringify(text)}));
  if (!node) throw new Error("no trigger containing " + ${JSON.stringify(text)});
  const opts = { bubbles: true, cancelable: true, button: 0, pointerId: 1, pointerType: "mouse" };
  node.dispatchEvent(new PointerEvent("pointerdown", opts));
  node.dispatchEvent(new PointerEvent("pointerup", opts));
  node.click();
  return true;`

const menuItem = (text) => `
  const item = [...document.querySelectorAll('[role="menuitem"], [role="menuitemcheckbox"]')]
    .find((n) => (n.textContent || "").includes(${JSON.stringify(text)}));
  if (!item) throw new Error(${JSON.stringify(text)} + " is not in the menu");
  item.click();
  return true;`

async function main() {
  const tag = Math.random().toString(36).slice(2, 10)
  const page = await launch({ port: 9390 })

  try {
    console.log("\n== sign up and open the studio ==")
    await page.goto(`${APP}/register`)
    await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
    await page.fill('input[autocomplete="name"]', "Journey Jo")
    await page.fill('input[type="email"]', `journey.${tag}@example.com`)
    await page.fill('input[type="password"]', "Password123")
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(clickText("Create account"))
    await page.waitFor(`location.pathname === "/"`, { label: "the studio", timeout: 25000 })
    await new Promise((r) => setTimeout(r, 2500))

    console.log("\n== paste a Flow file that already carries them ==")
    await page.evaluate(clickText("Paste"))
    await page.waitFor(`document.querySelector("textarea") !== null`, {
      label: "the paste dialog",
    })
    // The dialog's textarea is the only one on screen once it is open.
    await page.fill("textarea", PASTED)
    await new Promise((r) => setTimeout(r, 500))
    await page.evaluate(clickText("Replace"))
    await page.waitFor(
      `(() => { try { const s = JSON.parse(localStorage.getItem("ps:v1")).state;
         const p = s.projects.find((x) => x.id === s.activeId);
         return p && p.flows && p.flows.length > 0 } catch { return false } })()`,
      { label: "the journeys to land", timeout: 15000 }
    )

    const doc = await page.evaluate(activeDoc)
    check(
      "the journeys arrived with the paste",
      doc.flows.map((f) => f.key).join(",") === "auth,billing",
      JSON.stringify(doc.flows?.map((f) => f.key))
    )
    check(
      "each journey brought its own story",
      doc.flows.every((f) => f.story.want.trim()),
      JSON.stringify(doc.flows.map((f) => f.story))
    )
    check(
      "the journey's acceptance criteria survived the paste",
      doc.flows[0].story.criteria.length === 2,
      JSON.stringify(doc.flows[0].story.criteria)
    )

    const flowKeyOf = new Map(doc.flows.map((f) => [f.id, f.key]))
    const tagsOf = (key) =>
      doc.screens.find((s) => s.key === key).flows.map((id) => flowKeyOf.get(id))
    check("every screen was tagged", doc.screens.every((s) => s.flows.length))
    check("tags landed on the right screens", tagsOf("login").join() === "auth")
    check("a second journey's screens too", tagsOf("invoices").join() === "billing")
    const login = doc.screens.find((s) => s.key === "login")
    check(
      "a screen's own story came with it",
      login.story.role === "a signed-out user" &&
        login.story.criteria.length === 1,
      JSON.stringify(login.story)
    )

    console.log("\n== the canvas has a second way to read it ==")
    await page.evaluate(openMenu("Whole app"))
    await page.waitFor(
      `[...document.querySelectorAll('[role="menuitem"]')].some((n) => (n.textContent || "").includes("Authentication"))`,
      { label: "the journey picker" }
    )
    const offered = await page.evaluate(`
      return [...document.querySelectorAll('[role="menuitem"]')]
        .map((n) => (n.textContent || "").trim());`)
    check(
      "both journeys are offered, with their screen counts",
      offered.some((t) => t.includes("Authentication") && t.includes("2 screens")) &&
        offered.some((t) => t.includes("Billing") && t.includes("2 screens")),
      JSON.stringify(offered)
    )

    await page.evaluate(menuItem("Authentication"))
    await new Promise((r) => setTimeout(r, 1800))

    const filtered = await page.evaluate(`
      return {
        cards: [...document.querySelectorAll(".react-flow__node-screen")].map(
          (n) => (n.innerText || "").split("\\n")[1]
        ),
        text: document.body.innerText,
      };`)
    const keys = filtered.cards.filter(Boolean).sort()
    check(
      "the canvas filters to that journey's screens",
      keys.join(",") === "login,reset",
      JSON.stringify(filtered.cards)
    )
    check(
      "picking a journey opens its story",
      filtered.text.includes("get back in without contacting support"),
      "the flow inspector did not open"
    )
    check(
      "and its acceptance criteria",
      filtered.text.includes("a reset link expires 30 minutes after it is issued")
    )

    console.log("\n== a story typed here reaches the prompt ==")
    await page.evaluate(`
      const node = [...document.querySelectorAll(".react-flow__node-screen")]
        .find((n) => (n.innerText || "").includes("reset"));
      if (!node) throw new Error("the reset screen is not on the canvas");
      node.click();
      return true;`)
    await page.waitFor(`document.body.innerText.includes("User story")`, {
      label: "the screen inspector",
    })

    const typed = "choose a password nobody has to write down"
    await page.evaluate(`
      const field = [...document.querySelectorAll("input")]
        .find((i) => i.placeholder && i.placeholder.includes("see every client"));
      if (!field) throw new Error("the 'I want to' field is not there");
      field.setAttribute("data-under-test", "1");
      return true;`)
    await page.fill('input[data-under-test="1"]', typed)
    await new Promise((r) => setTimeout(r, 900))

    const saved = await page.evaluate(activeDoc)
    check(
      "the inspector wrote it to the document",
      saved.screens.find((s) => s.key === "reset").story.want === typed,
      JSON.stringify(saved.screens.find((s) => s.key === "reset").story)
    )

    await page.goto(`${APP}/print`)
    await page.waitFor(`document.querySelector(".prompt-markdown") !== null`, {
      label: "the rendered prompt",
      timeout: 20000,
    })
    const prompt = await page.evaluate(`return document.body.innerText`)
    // The section's *title* only renders for the markdown targets; claude-code
    // wraps blocks in XML tags instead. Assert on the body, which is the same
    // either way.
    check(
      "the prompt carries the journeys",
      prompt.includes("The product is made of these journeys"),
      prompt.slice(0, 200)
    )
    check("with the journey's story", prompt.includes("get back in without contacting support"))
    check("and the story typed by hand", prompt.includes(typed))
    check(
      "and tells the agent to write the missing ones",
      prompt.includes("docs/user-stories.md")
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
