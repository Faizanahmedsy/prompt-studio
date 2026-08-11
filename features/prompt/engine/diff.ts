export type DiffLine = {
  type: "same" | "add" | "del"
  text: string
}

/**
 * Line diff via a classic LCS table. Prompts are hundreds of lines at most, so
 * the O(n·m) table is cheaper than pulling in a diff library.
 */
export function diffLines(before: string, after: string): DiffLine[] {
  const a = before ? before.split("\n") : []
  const b = after ? after.split("\n") : []

  const lcs: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0)
  )
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i][j] =
        a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1])
    }
  }

  const out: DiffLine[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ type: "same", text: a[i] })
      i += 1
      j += 1
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      out.push({ type: "del", text: a[i] })
      i += 1
    } else {
      out.push({ type: "add", text: b[j] })
      j += 1
    }
  }
  while (i < a.length) {
    out.push({ type: "del", text: a[i] })
    i += 1
  }
  while (j < b.length) {
    out.push({ type: "add", text: b[j] })
    j += 1
  }
  return out
}

export function diffStats(lines: DiffLine[]) {
  return {
    added: lines.filter((l) => l.type === "add").length,
    removed: lines.filter((l) => l.type === "del").length,
  }
}
