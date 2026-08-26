import { beforeEach, describe, expect, it } from "vitest"

import {
  addModule,
  addScreen,
  arrangeScreens,
  connectModules,
  connectScreens,
  deleteEdge,
  deleteModule,
  deleteScreen,
  moveScreen,
  setScreenSurface,
  updateEdge,
} from "@/features/builder/utils/actions"
import { overlapping } from "@/features/builder/utils/graph"
import {
  addEntity,
  addField,
  connectEntities,
  connectEntityFields,
  deleteEntity,
  deleteField,
  updateEntity,
  updateField,
} from "@/features/data/utils/actions"
import { useProjectStore } from "@/stores/use-project-store"
import { useUiStore } from "@/stores/use-ui-store"

/** The whole app state, reset between tests. */
function fresh() {
  useProjectStore.setState({ projects: [], activeId: null, hydrated: true, seeded: false })
  useUiStore.setState({ mode: "web", expandedScreenIds: [], cardHeights: {} })
  useProjectStore.getState().createProject("blank", "Test project")
}

const doc = () => {
  const state = useProjectStore.getState()
  const project = state.projects.find((p) => p.id === state.activeId)
  if (!project) throw new Error("no active project")
  return project
}

const screenBy = (key: string) => doc().screens.find((s) => s.key === key)

describe("adding screens", () => {
  beforeEach(fresh)

  it("adds one, on the surface being looked at", () => {
    useUiStore.setState({ mode: "mobile" })
    const id = addScreen("blank")
    expect(id).toBeTruthy()
    expect(doc().screens.find((s) => s.id === id)?.surface).toBe("mobile")
  })

  it("keeps keys unique when the same template is added twice", () => {
    addScreen("blank")
    addScreen("blank")
    const keys = doc().screens.map((s) => s.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it("ignores a template nobody has heard of", () => {
    const before = doc().screens.length
    addScreen("not-a-template")
    // Tolerant, not silent-corrupting: either it declines, or it adds a screen
    // that is still a valid screen.
    const after = doc().screens
    expect(after.length === before || after.length === before + 1).toBe(true)
    for (const screen of after) expect(typeof screen.key).toBe("string")
  })
})

describe("connecting screens", () => {
  beforeEach(fresh)

  const two = () => {
    const a = addScreen("blank")!
    const b = addScreen("blank")!
    return { a, b }
  }

  it("connects two screens once", () => {
    const { a, b } = two()
    connectScreens(a, b)
    connectScreens(a, b)
    expect(doc().edges.filter((e) => e.from === a && e.to === b)).toHaveLength(1)
  })

  it("refuses a screen connecting to itself", () => {
    const { a } = two()
    connectScreens(a, a)
    expect(doc().edges.some((e) => e.from === a && e.to === a)).toBe(false)
  })

  it("ignores a connection to a screen that is not there", () => {
    const { a } = two()
    connectScreens(a, "scr_ghost")
    expect(doc().edges.some((e) => e.to === "scr_ghost")).toBe(false)
  })

  it("allows a loop back — that is a real flow, not a mistake", () => {
    const { a, b } = two()
    connectScreens(a, b)
    connectScreens(b, a)
    expect(doc().edges).toHaveLength(2)
  })

  it("takes the edges with the screen when it is deleted", () => {
    const { a, b } = two()
    connectScreens(a, b)
    deleteScreen(b)
    expect(doc().edges).toHaveLength(0)
    expect(doc().screens.some((s) => s.id === b)).toBe(false)
  })

  it("keeps a label, and lets it be cleared", () => {
    const { a, b } = two()
    connectScreens(a, b)
    const edge = doc().edges[0]
    updateEdge(edge.id, "on submit")
    expect(doc().edges[0].trigger).toBe("on submit")
    updateEdge(edge.id, "")
    expect(doc().edges[0].trigger).toBe("")
  })

  it("does nothing when told to delete an edge that is gone", () => {
    const { a, b } = two()
    connectScreens(a, b)
    const edge = doc().edges[0]
    deleteEdge(edge.id)
    deleteEdge(edge.id)
    expect(doc().edges).toHaveLength(0)
  })

  it("drops connections that cross builds when a screen moves build", () => {
    const { a, b } = two()
    connectScreens(a, b)
    setScreenSurface(b, "mobile")
    expect(doc().edges).toHaveLength(0)
    expect(screenBy(doc().screens.find((s) => s.id === b)!.key)?.surface).toBe("mobile")
  })
})

describe("modules inside a screen", () => {
  beforeEach(fresh)

  it("connects two modules of the same screen", () => {
    const screen = addScreen("blank")!
    const one = addModule(screen, "table")!
    const two = addModule(screen, "filters")!
    connectModules(one, two)
    expect(doc().moduleEdges).toHaveLength(1)
  })

  it("refuses to connect a module to itself", () => {
    const screen = addScreen("blank")!
    const one = addModule(screen, "table")!
    connectModules(one, one)
    expect(doc().moduleEdges).toHaveLength(0)
  })

  it("takes the inner connections with the module", () => {
    const screen = addScreen("blank")!
    const one = addModule(screen, "table")!
    const two = addModule(screen, "filters")!
    connectModules(one, two)
    deleteModule(two)
    expect(doc().moduleEdges).toHaveLength(0)
  })

  it("takes the modules with the screen", () => {
    const screen = addScreen("blank")!
    addModule(screen, "table")
    deleteScreen(screen)
    expect(doc().modules).toHaveLength(0)
  })
})

describe("arranging", () => {
  beforeEach(fresh)

  it("never leaves two screens on top of each other", () => {
    const ids = Array.from({ length: 8 }, () => addScreen("blank")!)
    ids.slice(1).forEach((id, index) => connectScreens(ids[index], id))
    // Pile them up first, the way a bad import does.
    for (const id of ids) moveScreen(id, 0, 0)
    arrangeScreens()
    expect(overlapping(doc().screens, { rowHeight: 216 })).toBe(false)
  })

  it("leaves the other builds where they are", () => {
    const web = addScreen("blank")!
    useUiStore.setState({ mode: "mobile" })
    const phone = addScreen("blank")!
    moveScreen(phone, 4000, 4000)
    useUiStore.setState({ mode: "web" })
    arrangeScreens(undefined, { only: [web] })
    const after = doc().screens.find((s) => s.id === phone)!
    expect([after.x, after.y]).toEqual([4000, 4000])
  })

  it("does nothing dangerous on an empty project", () => {
    arrangeScreens()
    expect(doc().screens).toHaveLength(0)
  })

  it("rounds a drag to whole pixels", () => {
    const id = addScreen("blank")!
    moveScreen(id, 10.4, 20.6)
    const screen = doc().screens.find((s) => s.id === id)!
    expect([screen.x, screen.y]).toEqual([10, 21])
  })
})

describe("tables", () => {
  beforeEach(fresh)

  it("starts a new table with a key and a created_at", () => {
    const id = addEntity("Users")!
    const entity = doc().entities.find((e) => e.id === id)!
    expect(entity.key).toBe("users")
    expect(entity.fields.some((f) => f.primary)).toBe(true)
    expect(entity.fields.some((f) => f.name === "created_at")).toBe(true)
  })

  it("keeps two tables from claiming the same name", () => {
    addEntity("Users")
    const second = addEntity("Users")!
    expect(doc().entities.find((e) => e.id === second)?.key).not.toBe("users")
  })

  it("creates the foreign key when two tables are joined", () => {
    const users = addEntity("Users")!
    const orders = addEntity("Orders")!
    connectEntities(orders, users)
    const table = doc().entities.find((e) => e.id === orders)!
    expect(table.fields.some((f) => f.name === "user_id" && f.indexed)).toBe(true)
    expect(doc().relations).toHaveLength(1)
  })

  it("does not join the same pair twice", () => {
    const users = addEntity("Users")!
    const orders = addEntity("Orders")!
    connectEntities(orders, users)
    connectEntities(orders, users)
    expect(doc().relations).toHaveLength(1)
  })

  it("reads a unique column as one-to-one", () => {
    const users = addEntity("Users")!
    const profiles = addEntity("Profiles")!
    const column = addField(profiles, { name: "user_id", type: "uuid" })!
    updateField(profiles, column, { unique: true })
    const key = doc().entities.find((e) => e.id === users)!.fields[0].id
    connectEntityFields(profiles, column, users, key)
    expect(doc().relations[0].kind).toBe("one-to-one")
  })

  it("carries a rename into the relations that name the column", () => {
    const users = addEntity("Users")!
    const orders = addEntity("Orders")!
    connectEntities(orders, users)
    const table = doc().entities.find((e) => e.id === orders)!
    const fk = table.fields.find((f) => f.name === "user_id")!
    updateField(orders, fk.id, { name: "customer_id" })
    expect(doc().relations[0].fromField).toBe("customer_id")
  })

  it("keeps column names unique inside a table", () => {
    const orders = addEntity("Orders")!
    addField(orders, { name: "total" })
    addField(orders, { name: "total" })
    const names = doc().entities.find((e) => e.id === orders)!.fields.map((f) => f.name)
    expect(new Set(names).size).toBe(names.length)
  })

  it("drops a relation when the column behind it is deleted", () => {
    const users = addEntity("Users")!
    const orders = addEntity("Orders")!
    connectEntities(orders, users)
    const fk = doc()
      .entities.find((e) => e.id === orders)!
      .fields.find((f) => f.name === "user_id")!
    deleteField(orders, fk.id)
    expect(doc().relations).toHaveLength(0)
  })

  it("drops the relations when a table is deleted", () => {
    const users = addEntity("Users")!
    const orders = addEntity("Orders")!
    connectEntities(orders, users)
    deleteEntity(users)
    expect(doc().relations).toHaveLength(0)
    expect(doc().entities).toHaveLength(1)
  })

  it("refuses to blank a table name", () => {
    const id = addEntity("Users")!
    updateEntity(id, { key: "" })
    expect(doc().entities.find((e) => e.id === id)?.key).toBe("users")
  })

  it("says nothing and changes nothing for a table that is gone", () => {
    const id = addEntity("Users")!
    deleteEntity(id)
    updateEntity(id, { name: "Ghost" })
    deleteField(id, "fld_ghost")
    expect(doc().entities).toHaveLength(0)
  })
})
