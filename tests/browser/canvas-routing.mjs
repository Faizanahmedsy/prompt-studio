/**
 * A big diagram, measured rather than eyeballed.
 *
 * The complaint that started this was "lines overlapping over the screens", on
 * a project of ninety-odd screens — which no unit test can see and no small
 * example reproduces. So this builds a dense graph, renders it, and reads the
 * geometry back out of the browser: every card against every other card, every
 * drawn path sampled along its length against every card it does not belong to,
 * and every label against every other label.
 */
import { launch } from "./cdp.mjs"

const APP = process.env.APP ?? "http://localhost:3002"
const fails = []
const check = (label, ok, extra = "") => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `  <- ${extra}`}`)
  if (!ok) fails.push(label)
}

const clickText = (text) => `
  const node = [...document.querySelectorAll("button, [role=menuitem]")]
    .find((b) => (b.getAttribute("aria-label") || b.textContent || "").trim().startsWith(${JSON.stringify(text)}));
  if (!node) throw new Error("no control " + ${JSON.stringify(text)});
  node.click();
  return true;`

/** 48 screens in twelve journeys, with shortcuts and returns — a real diagram's shape. */
function denseFlow() {
  const groups = ["auth", "onboarding", "buckets", "pins", "social", "billing", "admin", "settings"]
  const lines = [
    'app "Dense" {',
    "  target claude-code",
    "  builds web",
    "}",
    "",
    "flows {",
    ...groups.map((g) => `  flow ${g} "${g}" { story { as "someone"; want "${g}"; so "reasons" } }`),
    "}",
    "",
  ]
  const screens = []
  lines.push('screen hub "Everything" { template detail; layout detail-with-hero; flows [buckets] }')
  for (const group of groups) {
    for (let i = 0; i < 6; i += 1) {
      const key = `${group}_${i}`
      screens.push({ key, group })
      // Every third screen carries modules, so "Expand all" has something to
      // do — an expanded card is three times taller, which is the case that
      // used to drop rows through the screen below.
      const modules =
        i % 3 === 0
          ? ` module filters "Filters" { kind filters } module table "Table" { kind table } inner { filters -> table : "on filter change" }`
          : ""
      lines.push(
        `screen ${key} "${group} ${i}" { template ${i % 2 ? "table" : "detail"}; layout ${
          i % 2 ? "table-basic" : "detail-two-column"
        }; flows [${group}]${modules} }`
      )
    }
  }
  lines.push("", "flow {")
  for (const group of groups) {
    for (let i = 0; i < 5; i += 1) {
      lines.push(`  ${group}_${i} -> ${group}_${i + 1} : "step ${i}"`)
    }
    // a return to the start of the journey, and a shortcut past the middle
    lines.push(`  ${group}_5 -> ${group}_0 : "back to the start"`)
    lines.push(`  ${group}_0 -> ${group}_4 : "skip ahead"`)
  }
  // and the journeys joined to each other
  for (let i = 0; i < groups.length - 1; i += 1) {
    lines.push(`  ${groups[i]}_5 -> ${groups[i + 1]}_0 : "on to ${groups[i + 1]}"`)
  }
  lines.push(`  ${groups[groups.length - 1]}_5 -> ${groups[0]}_0 : "sign out"`)
  // The shape that broke it worst: many journeys converging on one screen, each
  // arriving with its own label, and the hub pointing back out again.
  for (const group of groups) {
    lines.push(`  ${group}_2 -> hub : "click a ${group} item"`)
    lines.push(`  hub -> ${group}_3 : "open the ${group} it belongs to"`)
  }
  lines.push("}")
  return lines.join("\n")
}

/**
 * Read the rendered geometry: cards, sampled edge paths, and label chips.
 *
 * Sampling rather than trusting the path data — what matters is where the line
 * is actually drawn, not what we meant to draw.
 */
const geometry = `
  const store = JSON.parse(localStorage.getItem("ps:v1"));
  const project = store.state.projects.find((p) => p.id === store.state.activeId);
  const ends = new Map(project.edges.map((e) => [e.id, [e.from, e.to]]));

  const nodes = [...document.querySelectorAll(".react-flow__node")].map((n) => {
    const r = n.getBoundingClientRect();
    return { id: n.getAttribute("data-id"), x: r.x, y: r.y, w: r.width, h: r.height };
  });

  const inside = (px, py, box, pad) =>
    px > box.x + pad && px < box.x + box.w - pad &&
    py > box.y + pad && py < box.y + box.h - pad;

  const crossings = [];
  for (const group of document.querySelectorAll(".react-flow__edge")) {
    const id = group.getAttribute("data-id");
    const path = group.querySelector("path.react-flow__edge-path");
    if (!path || !id) continue;
    const own = ends.get(id) || [];
    const length = path.getTotalLength();
    if (!length) continue;
    for (let at = 0; at <= length; at += 6) {
      const point = path.getPointAtLength(at);
      const screenPoint = path.getScreenCTM
        ? new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM())
        : point;
      for (const node of nodes) {
        if (own.includes(node.id)) continue;
        // 6px of tolerance: a line running along a card's edge is fine, a line
        // drawn through its middle is not.
        if (inside(screenPoint.x, screenPoint.y, node, 6)) {
          crossings.push(id + " through " + node.id);
          at = length + 1;
          break;
        }
      }
    }
  }

  // Every drawn path, sampled, in screen coordinates — used to check that no
  // line is drawn across a label chip.
  const samples = [];
  for (const group of document.querySelectorAll(".react-flow__edge")) {
    const path = group.querySelector("path.react-flow__edge-path");
    const id = group.getAttribute("data-id");
    if (!path || !id) continue;
    const length = path.getTotalLength();
    for (let at = 0; at <= length; at += 8) {
      const raw = path.getPointAtLength(at);
      const point = new DOMPoint(raw.x, raw.y).matrixTransform(path.getScreenCTM());
      samples.push({ id, x: point.x, y: point.y });
    }
  }

  const labels = [...document.querySelectorAll(".react-flow__edgelabel-renderer > div")]
    .map((n) => {
      const r = n.getBoundingClientRect();
      return {
        id: n.getAttribute("data-edge-id") || "",
        text: (n.innerText || "").trim(),
        x: r.x,
        y: r.y,
        w: r.width,
        h: r.height,
      };
    })
    .filter((l) => l.w > 0 && l.h > 0);

  // A line passing behind a label is invisible — the chip is opaque and drawn
  // above the connections. A label sitting on a card is not: it covers the
  // screen's own name.
  const struck = [];
  for (const label of labels) {
    for (const node of nodes) {
      if (
        label.x < node.x + node.w - 4 && node.x < label.x + label.w - 4 &&
        label.y < node.y + node.h - 4 && node.y < label.y + label.h - 4
      ) {
        struck.push((label.text || "?") + " over " + node.id);
        break;
      }
    }
  }

  return { nodes, crossings: [...new Set(crossings)], labels, struck };`

function anyOverlap(boxes) {
  const pad = 3
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i]
      const b = boxes[j]
      if (
        a.x + a.w - pad > b.x &&
        b.x + b.w - pad > a.x &&
        a.y + a.h - pad > b.y &&
        b.y + b.h - pad > a.y
      ) {
        return `${a.id ?? a.text} over ${b.id ?? b.text}`
      }
    }
  }
  return ""
}

async function main() {
  const tag = Math.random().toString(36).slice(2, 10)
  const page = await launch({ port: 9394 })
  try {
    console.log("\n== sign up ==")
    await page.goto(`${APP}/register`)
    await page.waitFor(`document.querySelector('input[type=email]')`, { label: "register form" })
    await page.fill('input[autocomplete="name"]', "Dense Dee")
    await page.fill('input[type="email"]', `dense.${tag}@example.com`)
    await page.fill('input[type="password"]', "Password123")
    await new Promise((r) => setTimeout(r, 400))
    await page.evaluate(clickText("Create account"))
    await page.waitFor(`["/","/web","/mobile","/backend","/landing","/data","/code","/design"].includes(location.pathname)`, { label: "the studio", timeout: 25000 })
    await page.waitFor(`document.querySelector(".react-flow") !== null`, {
      label: "the canvas",
      timeout: 25000,
    })
    await new Promise((r) => setTimeout(r, 2500))

    console.log("\n== paste 49 screens in 8 journeys, all converging on one ==")
    await page.evaluate(clickText("Paste Flow"))
    await page.waitFor(`document.querySelector("[role=dialog] textarea") !== null`, {
      label: "the paste dialog",
    })
    await page.fill("[role=dialog] textarea", denseFlow())
    await new Promise((r) => setTimeout(r, 900))
    await page.evaluate(clickText("Replace project"))
    await new Promise((r) => setTimeout(r, 3500))

    const first = await page.evaluate(geometry)
    check("every screen is drawn", first.nodes.length === 49, `${first.nodes.length}`)
    check("no card sits on another", !anyOverlap(first.nodes), anyOverlap(first.nodes))
    check(
      "no connection is drawn through a card",
      first.crossings.length === 0,
      `${first.crossings.length}: ${first.crossings.slice(0, 3).join(", ")}`
    )
    check(
      "no two labels print over each other",
      !anyOverlap(first.labels),
      anyOverlap(first.labels)
    )
    check(
      "no label sits on top of a card",
      first.struck.length === 0,
      `${first.struck.length}: ${first.struck.slice(0, 3).join(", ")}`
    )

    console.log("\n== after auto-arrange ==")
    await page.evaluate(clickText("Auto-arrange"))
    await new Promise((r) => setTimeout(r, 2500))
    const after = await page.evaluate(geometry)
    check("still no card on a card", !anyOverlap(after.nodes), anyOverlap(after.nodes))
    check(
      "still no line through a card",
      after.crossings.length === 0,
      `${after.crossings.length}: ${after.crossings.slice(0, 3).join(", ")}`
    )
    check("still no label on a label", !anyOverlap(after.labels), anyOverlap(after.labels))
    check(
      "still no label on a card",
      after.struck.length === 0,
      `${after.struck.length}: ${after.struck.slice(0, 3).join(", ")}`
    )

    console.log("\n== with every screen expanded ==")
    await page.evaluate(clickText("Expand all"))
    await new Promise((r) => setTimeout(r, 3000))
    const expanded = await page.evaluate(geometry)
    check(
      "expanding does not pile the cards up",
      !anyOverlap(expanded.nodes.filter((n) => n.w > 100)),
      anyOverlap(expanded.nodes.filter((n) => n.w > 100))
    )

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
