/**
 * The data model, and a canvas you can read.
 *
 * Two things the unit tests cannot prove: that a person can actually reach the
 * tables through the UI, and that what lands on the canvas does not overlap
 * itself. Both were real faults — nodes on top of nodes after auto-arrange, and
 * toolbars parked over the first screen — so both are asserted here from the
 * rendered geometry rather than from the store.
 */
import { launch } from "./cdp.mjs"

const APP = process.env.APP ?? "http://localhost:3002"
const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

/**
 * Radix tabs listen for pointer events, not a bare `click()` — clicking the
 * Data tab with `HTMLElement.click()` did nothing, and the test then reported
 * the flow canvas's six screens as six tables.
 */
const clickTab = (text) => `
  const tab = [...document.querySelectorAll("[role=tab]")]
    .find((t) => (t.textContent || "").trim().startsWith(${JSON.stringify(text)}));
  if (!tab) throw new Error("no tab " + ${JSON.stringify(text)});
  for (const type of ["pointerdown","mousedown","pointerup","mouseup","click"]) {
    tab.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true }));
  }
  return true;`

const columnCount = (key) => `
  const store = JSON.parse(localStorage.getItem("ps:v1"));
  const p = store.state.projects.find((x) => x.id === store.state.activeId);
  const table = p.entities.find((e) => e.key === ${JSON.stringify(key)});
  return table ? table.fields.length : -1;`

const clickText = (text) => `
  const node = [...document.querySelectorAll("button, [role=menuitem], [role=tab]")]
    .find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().startsWith(${JSON.stringify(text)}));
  if (!node) throw new Error("no control " + ${JSON.stringify(text)});
  node.click();
  return true;`

const project = `
  const store = JSON.parse(localStorage.getItem("ps:v1"));
  return store.state.projects.find((p) => p.id === store.state.activeId);`

/** Every rendered node's box, in viewport pixels. */
const nodeBoxes = `
  return [...document.querySelectorAll(".react-flow__node")].map((n) => {
    const r = n.getBoundingClientRect();
    return { id: n.getAttribute("data-id"), x: r.x, y: r.y, w: r.width, h: r.height };
  });`

/** Distinct stroke colours across the drawn edges. */
const edgeColours = `
  return [...new Set([...document.querySelectorAll(".react-flow__edge-path")]
    .map((p) => getComputedStyle(p).stroke))];`

function overlaps(a, b) {
  // A couple of pixels of touching is not an overlap; a card sitting on top of
  // another one is.
  const pad = 3
  return (
    a.x + a.w - pad > b.x &&
    b.x + b.w - pad > a.x &&
    a.y + a.h - pad > b.y &&
    b.y + b.h - pad > a.y
  )
}

function anyOverlap(boxes) {
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (overlaps(boxes[i], boxes[j])) return `${boxes[i].id} over ${boxes[j].id}`
    }
  }
  return ""
}

const FLOW = `app "Shop" {
  target claude-code
  builds web, backend
}

flows {
  flow buying "Buying something" { story { as "a shopper"; want "buy a thing"; so "I have the thing" } }
}

screen catalogue "Catalogue" { template table; layout table-basic; flows [buying] }
screen product   "Product"   { template detail; layout detail-two-column; flows [buying] }
screen basket    "Basket"    { template detail; layout detail-two-column; flows [buying] }
screen checkout  "Checkout"  { template form; layout form-sidebar-summary; flows [buying] }
screen orders    "My orders" { template table; layout table-basic; flows [buying] }
screen help      "Help"      { template blank; layout blank-centered; flows [buying] }

flow {
  catalogue -> product  : "click a product"
  product   -> basket   : "add to basket"
  basket    -> checkout : "checkout"
  checkout  -> orders   : "on payment"
  orders    -> catalogue : "keep shopping"
  catalogue -> help     : "click Help"
  catalogue -> checkout : "buy it now"
}

data {
  table users "Users" {
    id uuid pk
    email string unique required
    created_at timestamp required default "now()"
  }
  table products "Products" {
    id uuid pk
    name string required
    price decimal required
    status enum [draft, live] required default "draft"
  }
  table orders "Orders" {
    id uuid pk
    user_id uuid required index
    total decimal required
    created_at timestamp required default "now()"
  }
  table order_items "Order items" {
    id uuid pk
    order_id uuid required index
    product_id uuid required index
    quantity integer required default "1"
  }

  rel orders.user_id -> users.id : many-to-one "an order belongs to a customer" on_delete restrict
  rel order_items.order_id -> orders.id : many-to-one on_delete cascade
  rel order_items.product_id -> products.id : many-to-one on_delete restrict
  rel products <-> users : many-to-many through wishlists
}
`

async function main() {
  const tag = Math.random().toString(36).slice(2, 10)
  const page = await launch({ port: 9392 })
  try {
    console.log("\n== sign up ==")
    await page.goto(`${APP}/register`)
    await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
    await page.fill('input[autocomplete="name"]', "Data Dana")
    await page.fill('input[type="email"]', `data.${tag}@example.com`)
    await page.fill('input[type="password"]', "Password123")
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(clickText("Create account"))
    await page.waitFor(`["/web","/mobile","/backend","/landing","/data","/code","/design"].includes(location.pathname)`, { label: "the studio", timeout: 25000 })
    await page.waitFor(`document.querySelector(".react-flow") !== null`, {
      label: "the canvas",
      timeout: 25000,
    })
    await new Promise((r) => setTimeout(r, 2500))

    console.log("\n== paste a project that has a data model ==")
    await page.evaluate(clickText("Paste Flow"))
    await page.waitFor(`document.querySelector("[role=dialog] textarea") !== null`, {
      label: "the paste dialog",
    })
    await page.fill("[role=dialog] textarea", FLOW)
    await new Promise((r) => setTimeout(r, 600))

    const summary = await page.evaluate(
      `return document.querySelector("[role=dialog]").innerText`
    )
    check("the paste preview counts the tables", /4 tables/.test(summary), summary.slice(0, 200))
    check("and the relations", /4 relations/.test(summary))

    await page.evaluate(clickText("Replace project"))
    await new Promise((r) => setTimeout(r, 2000))

    const doc = await page.evaluate(project)
    check("the tables landed", doc.entities.length === 4, `${doc.entities.length}`)
    check("the relations landed", doc.relations.length === 4, `${doc.relations.length}`)
    check(
      "the join table was recorded",
      doc.relations.some((r) => r.kind === "many-to-many" && r.through === "wishlists")
    )

    console.log("\n== the flow canvas reads as a flow ==")
    await new Promise((r) => setTimeout(r, 1200))
    const flowBoxes = await page.evaluate(nodeBoxes)
    check("every screen is drawn", flowBoxes.length === 6, `${flowBoxes.length}`)
    check("no screen sits on top of another", !anyOverlap(flowBoxes), anyOverlap(flowBoxes))

    const colours = await page.evaluate(edgeColours)
    check(
      "connections are coloured by what they mean",
      colours.length >= 3,
      colours.join(" / ")
    )

    // The toolbars float over the canvas; fitting has to keep clear of them.
    const chrome = await page.evaluate(`
      const bar = [...document.querySelectorAll("div")].find((d) =>
        d.className.includes("absolute") && d.className.includes("top-3") && d.className.includes("right-3"));
      if (!bar) return null;
      const r = bar.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };`)
    const covered = chrome
      ? flowBoxes.filter((box) => overlaps(box, chrome)).map((b) => b.id)
      : []
    check("nothing is hidden under the toolbar", covered.length === 0, covered.join(", "))

    console.log("\n== auto-arrange leaves it readable ==")
    await page.evaluate(clickText("Auto-arrange"))
    await new Promise((r) => setTimeout(r, 1500))
    const arranged = await page.evaluate(nodeBoxes)
    check("still nothing overlapping", !anyOverlap(arranged), anyOverlap(arranged))

    console.log("\n== the data tab ==")
    await page.evaluate(clickTab("Data"))
    await new Promise((r) => setTimeout(r, 1500))
    const tableBoxes = await page.evaluate(nodeBoxes)
    check("every table is drawn", tableBoxes.length === 4, `${tableBoxes.length}`)
    check("no table sits on top of another", !anyOverlap(tableBoxes), anyOverlap(tableBoxes))

    const relationColours = await page.evaluate(edgeColours)
    check(
      "relations are coloured by kind",
      relationColours.length >= 2,
      relationColours.join(" / ")
    )

    // Edge labels are portalled into the label renderer, not nested inside the
    // <path> — reading the edge element itself returns nothing.
    const cardinality = await page.evaluate(
      `return document.querySelector(".react-flow__edgelabel-renderer")?.innerText ?? ""`
    )
    check("each relation says which way it runs", /N:1/.test(cardinality), cardinality.slice(0, 80))

    console.log("\n== editing a table ==")
    const before = await page.evaluate(columnCount("products"))
    await page.evaluate(`
      const node = [...document.querySelectorAll(".react-flow__node")]
        .find((n) => n.innerText.includes("products"));
      const add = [...node.querySelectorAll("button")].find((b) => b.textContent.includes("Add column"));
      add.click();
      return true;`)
    await new Promise((r) => setTimeout(r, 800))
    const after = await page.evaluate(columnCount("products"))
    check("a column can be added from the table itself", after === before + 1, `${before} → ${after}`)

    console.log("\n== the prompt carries the schema ==")
    await page.evaluate(clickTab("Web"))
    await new Promise((r) => setTimeout(r, 1800))
    const promptText = await page.evaluate(`
      return [...document.querySelectorAll("pre.code-surface")].map((n) => n.innerText).join("\\n")`)
    check("the schema is in the prompt", /order_items/.test(promptText), promptText.slice(0, 120))
    check("with the relations spelled out", /many rows point at one/.test(promptText))
    const bodyText = await page.evaluate(`return document.body.innerText`)
    check("and no token estimate anywhere", !/~tokens/.test(bodyText))

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
