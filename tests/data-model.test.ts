import { describe, expect, it } from "vitest"

import { checkDataModel } from "@/features/data/utils/schema"
import { parseFlow } from "@/features/flow-lang/parser"
import { serializeFlow } from "@/features/flow-lang/serializer"

const source = `
app "Shop" { target claude-code }

data {
  table users "Users" {
    note "Anyone who can sign in."
    id uuid pk
    email string unique required
    role enum [admin, member] default "member"
    created_at timestamp required default "now()"
  }
  table orders "Orders" {
    id uuid pk
    user_id uuid required index
    total decimal required
    status enum [draft, paid] default "draft"
  }
  table tags "Tags" {
    id uuid pk
    name string unique required
  }

  rel orders.user_id -> users.id : many-to-one "an order belongs to a customer" on_delete cascade
  rel orders <-> tags : many-to-many through order_tags
}

screen home "Home" { template dashboard }
`

const parsed = () => parseFlow(source)

describe("reading a data model", () => {
  it("reads every table and column", () => {
    const { doc, errors } = parsed()
    expect(errors).toEqual([])
    expect(doc.entities.map((e) => e.key)).toEqual(["users", "orders", "tags"])

    const users = doc.entities[0]
    expect(users.name).toBe("Users")
    expect(users.note).toBe("Anyone who can sign in.")
    expect(users.fields.map((f) => f.name)).toEqual([
      "id",
      "email",
      "role",
      "created_at",
    ])
  })

  it("reads the flags on a column", () => {
    const users = parsed().doc.entities[0]
    const id = users.fields[0]
    const email = users.fields[1]
    const role = users.fields[2]
    const created = users.fields[3]

    expect(id.primary).toBe(true)
    expect(id.required).toBe(true)
    expect(email.unique).toBe(true)
    expect(email.required).toBe(true)
    expect(email.primary).toBe(false)
    expect(role.options).toEqual(["admin", "member"])
    expect(role.defaultValue).toBe("member")
    expect(created.defaultValue).toBe("now()")
  })

  it("reads both kinds of relation", () => {
    const { doc } = parsed()
    const byKey = new Map(doc.entities.map((e) => [e.id, e.key]))
    const [belongs, join] = doc.relations

    expect(byKey.get(belongs.from)).toBe("orders")
    expect(belongs.fromField).toBe("user_id")
    expect(byKey.get(belongs.to)).toBe("users")
    expect(belongs.toField).toBe("id")
    expect(belongs.kind).toBe("many-to-one")
    expect(belongs.onDelete).toBe("cascade")
    expect(belongs.label).toBe("an order belongs to a customer")

    expect(join.kind).toBe("many-to-many")
    expect(join.through).toBe("order_tags")
  })

  it("does not mistake a relation for a screen transition", () => {
    const { doc } = parsed()
    expect(doc.screens.map((s) => s.key)).toEqual(["home"])
  })

  it("lays the tables out instead of stacking them at the origin", () => {
    const { doc } = parsed()
    const positions = new Set(doc.entities.map((e) => `${e.x},${e.y}`))
    expect(positions.size).toBe(doc.entities.length)
  })
})

describe("round trip", () => {
  it("survives serialize → parse unchanged", () => {
    const first = parsed().doc
    const again = parseFlow(serializeFlow(first)).doc

    const shape = (doc: typeof first) =>
      doc.entities.map((entity) => ({
        key: entity.key,
        name: entity.name,
        note: entity.note,
        fields: entity.fields.map((field) => ({
          name: field.name,
          type: field.type,
          primary: field.primary,
          required: field.required,
          unique: field.unique,
          indexed: field.indexed,
          defaultValue: field.defaultValue,
          options: field.options,
        })),
      }))

    expect(shape(again)).toEqual(shape(first))

    const relations = (doc: typeof first) => {
      const key = new Map(doc.entities.map((e) => [e.id, e.key]))
      return doc.relations.map((relation) => ({
        from: key.get(relation.from),
        fromField: relation.fromField,
        to: key.get(relation.to),
        toField: relation.toField,
        kind: relation.kind,
        onDelete: relation.onDelete,
        through: relation.through,
        label: relation.label,
      }))
    }
    expect(relations(again)).toEqual(relations(first))
  })
})

describe("tolerance", () => {
  it("accepts a relation written before the tables it joins", () => {
    const { doc, errors } = parseFlow(`
data {
  rel orders.user_id -> users.id
  table users "Users" { id uuid pk }
  table orders "Orders" { id uuid pk; user_id uuid }
}
`)
    expect(errors).toEqual([])
    expect(doc.relations).toHaveLength(1)
    expect(doc.entities.map((e) => e.key).sort()).toEqual(["orders", "users"])
  })

  it("creates a table a relation names but nobody declared", () => {
    const { doc, warnings } = parseFlow(`
data {
  table orders "Orders" { id uuid pk }
  rel orders.customer_id -> customers.id
}
`)
    expect(doc.entities.map((e) => e.key)).toContain("customers")
    expect(warnings.some((w) => w.message.includes("not declared"))).toBe(true)
  })

  it("creates the foreign key column a relation needs", () => {
    const { doc } = parseFlow(`
data {
  table users "Users" { id uuid pk }
  table orders "Orders" { id uuid pk }
  rel orders.user_id -> users.id
}
`)
    const orders = doc.entities.find((e) => e.key === "orders")!
    const fk = orders.fields.find((f) => f.name === "user_id")
    expect(fk).toBeTruthy()
    expect(fk?.indexed).toBe(true)
  })

  it("reads the short cardinality spellings", () => {
    const { doc } = parseFlow(`
data {
  table a "A" { id uuid pk }
  table b "B" { id uuid pk }
  table c "C" { id uuid pk }
  rel a.b_id -> b.id : n:1
  rel b -> c : 1:1
}
`)
    expect(doc.relations.map((r) => r.kind)).toEqual(["many-to-one", "one-to-one"])
  })

  it("reads a join written on the column itself", () => {
    const { doc } = parseFlow(`
data {
  table users "Users" { id uuid pk }
  table posts "Posts" {
    id uuid pk
    author_id uuid required ref users.id
  }
}
`)
    expect(doc.relations).toHaveLength(1)
    expect(doc.relations[0].fromField).toBe("author_id")
    expect(doc.relations[0].toField).toBe("id")
  })

  it("keeps the second of two columns with the same name, and says so", () => {
    const { doc, warnings } = parseFlow(`
data {
  table users "Users" {
    id uuid pk
    email text
    email string unique
  }
}
`)
    const users = doc.entities[0]
    expect(users.fields.filter((f) => f.name === "email")).toHaveLength(1)
    expect(users.fields.find((f) => f.name === "email")?.unique).toBe(true)
    expect(warnings.some((w) => w.message.includes("declared twice"))).toBe(true)
  })

  it("keeps a column type it has never heard of", () => {
    const { doc, warnings } = parseFlow(`
data { table t "T" { id uuid pk; location geography } }
`)
    expect(doc.entities[0].fields[1].type).toBe("geography")
    expect(warnings.some((w) => w.message.includes("geography"))).toBe(true)
  })

  it("reads a data model with no relations at all", () => {
    const { doc, errors } = parseFlow(`
data { table settings "Settings" { id uuid pk; theme text } }
screen home "Home" {}
`)
    expect(errors).toEqual([])
    expect(doc.entities).toHaveLength(1)
    expect(doc.relations).toHaveLength(0)
  })
})

describe("checks", () => {
  const project = (flow: string) => ({
    ...parseFlow(flow).doc,
  })

  it("passes a model that is fully wired", () => {
    expect(checkDataModel(project(source)).filter((i) => i.level === "error")).toEqual(
      []
    )
  })

  it("catches a table with no primary key", () => {
    const issues = checkDataModel(
      project(`data { table t "T" { name text } }`)
    )
    expect(issues.some((i) => i.level === "error" && i.message.includes("primary key"))).toBe(
      true
    )
  })

  it("catches a relation pointing at a column that is not there", () => {
    const doc = project(`
data {
  table a "A" { id uuid pk }
  table b "B" { id uuid pk }
  rel a.b_id -> b.id
}
`)
    // Break it the way renaming a column by hand would.
    const a = doc.entities.find((e) => e.key === "a")!
    a.fields = a.fields.filter((f) => f.name !== "b_id")
    const issues = checkDataModel(doc)
    expect(issues.some((i) => i.level === "error" && i.message.includes("b_id"))).toBe(
      true
    )
  })

  it("warns about a foreign key that joins nothing", () => {
    const issues = checkDataModel(
      project(`data { table orders "Orders" { id uuid pk; user_id uuid } }`)
    )
    expect(
      issues.some((i) => i.level === "warning" && i.message.includes("joins nothing"))
    ).toBe(true)
  })

  it("warns about an enum with no values", () => {
    const issues = checkDataModel(
      project(`data { table t "T" { id uuid pk; status enum } }`)
    )
    expect(issues.some((i) => i.message.includes("enum with no values"))).toBe(true)
  })

  it("says nothing about an empty project", () => {
    expect(checkDataModel(parseFlow(`screen home "Home" {}`).doc)).toEqual([])
  })
})
