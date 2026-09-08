import type { LibraryPrompt } from "./types"

/**
 * The rest of the library: the prompts a developer reaches for in a week that
 * has nothing to do with design.
 *
 * Each one exists because the default answer to that request is reliably bad
 * in a specific way — a debugger that proposes a fix before it has a cause, a
 * reviewer that lists everything it noticed rather than what matters, an
 * estimate given without saying what it assumed. The prompt is the correction,
 * not a description of the task.
 */
export const workPrompts: LibraryPrompt[] = [
  {
    id: "root-cause",
    title: "Find the cause before the fix",
    blurb:
      "Stops the guess-and-check loop: it has to explain the symptom before it is allowed to change anything.",
    category: "Debug",
    tags: ["debug", "bug", "root cause", "investigation", "failure"],
    howToUse:
      "Paste the error, the stack trace, and what you were doing. Give it repository access if your tool has it.",
    body: `Debug this properly. You do not get to propose a fix until you can explain the symptom.

Work in this order and show each step:

1. **State the symptom precisely.** What happens, what you expected instead, and how reliably. If it is intermittent, say what changes between the runs that fail and the runs that do not.
2. **Establish the facts you actually have.** Quote the error and the relevant lines of the trace. Separate what the evidence says from what you are inferring. Mark inferences as inferences.
3. **List every hypothesis that fits the evidence** — at least three, including at least one that assumes the bug is somewhere other than where the error surfaced. Order them by how well they explain the evidence, not by how easy they would be to fix.
4. **For the leading hypothesis, name the observation that would disprove it.** Then go and make that observation: read the file, trace the value, check the config, add the log line. Say what you found.
5. **Only once one hypothesis survives**, explain the causal chain from cause to symptom in plain language. Every link has to be something you verified, not something that sounds right.
6. **Then fix it** — the cause, not the symptom. If the honest fix is larger than the bug report implies, say so rather than patching around it.
7. **Say how you know it is fixed**, and what test would have caught it. Write that test.

Rules for the whole exercise:

- Never change code to see what happens. Changing code is a fix, not an experiment; experiments are reads, logs and traces.
- If two things changed at once, separate them before you continue.
- If the evidence contradicts your leading hypothesis, say so and go back to the list rather than adding a special case to keep it alive.
- If you cannot find the cause, say that plainly and tell me the one piece of information that would unblock you. A confident wrong answer costs more than an honest dead end.

Here is the problem:

[paste the error, the stack trace, and what you were doing when it happened]`,
  },

  {
    id: "review-diff",
    title: "Review a diff like a senior engineer",
    blurb:
      "Ranked findings with a concrete failure case each — not a list of everything it noticed.",
    category: "Review",
    tags: ["review", "code review", "pull request", "diff", "quality"],
    howToUse:
      "Paste the diff, or point it at the branch. Say what the change is meant to do — a reviewer who does not know the intent can only check style.",
    body: `Review this change the way a senior engineer reviews a colleague's pull request: looking for what will break or what will cost us later, not for everything that could be said about it.

Find, in this order of priority:

1. **Correctness.** Logic that is wrong, not just unusual. Off-by-one, inverted condition, a case the branch does not handle, a promise not awaited, an error swallowed, state mutated where a copy was meant.
2. **Things that only break later.** Race conditions, unbounded growth, a query that is fine at a thousand rows and fatal at a million, a migration that is not reversible, a cache that is never invalidated.
3. **Security and data.** Unvalidated input reaching a query or a shell, an authorisation check on the client only, a secret in the source, a permissive default, personal data in a log line.
4. **Reuse and simplification.** Something the codebase already does elsewhere that this reimplements. A branch that cannot be taken. A layer of indirection carrying one call.

For each finding, give me exactly this and nothing more:

- **Where** — file and line.
- **What** — one sentence stating the defect.
- **The failure** — concrete inputs or state, and the wrong output or crash they produce. If you cannot construct one, the finding is speculation; drop it.
- **The fix** — the smallest change that resolves it.

Then rank them most serious first.

What not to do:

- Do not report style, formatting or naming unless it is actively misleading.
- Do not suggest a rewrite of code the diff only touched in passing.
- Do not pad the list. Three real findings beats fifteen observations. If the change is fine, say it is fine.
- Do not restate what the change does back to me.

The change is meant to:

[one sentence]

Here is the diff:

[paste the diff]`,
  },

  {
    id: "spec-from-vague",
    title: "Turn a vague request into a spec",
    blurb:
      "Pulls the hidden decisions out of a one-line request before anybody writes code against it.",
    category: "Plan",
    tags: ["plan", "spec", "requirements", "scope", "product"],
    howToUse:
      "Paste the request exactly as you received it — the messy version is the useful one.",
    body: `I have been given the request below. Before anyone builds it, turn it into something buildable.

Produce:

**1. What is actually being asked for.** Restate it in two sentences, in the requester's terms rather than in technical ones.

**2. The decisions hidden inside it.** Every point where the request could reasonably mean two different things and the two would lead to different software. For each: the question, the options, which you would choose and why. Do not ask me — decide, and mark it as an assumption. I will correct the ones you get wrong, which is faster than answering a list of questions.

**3. Scope.** Three lists:
- *In* — what a first version must do to be worth shipping at all.
- *Out* — what a reasonable person might assume is included and is not. This list is the valuable one; be generous with it.
- *Later* — what is obviously coming next, so the design does not paint us into a corner.

**4. The unhappy paths.** What happens when it is empty, when it is slow, when the input is wrong, when the person is not allowed, when the thing they are acting on was deleted while they had it open. Most requests describe only the day it works.

**5. Data.** What has to be stored that is not stored today, and what existing data this depends on being correct.

**6. Done.** Five to eight criteria a person could check by using the product, in the requester's language rather than the framework's. "An empty result says what to change", not "renders the EmptyState component".

**7. The one thing most likely to make this take three times as long as it looks.** Say it plainly.

Keep the whole thing under two pages. If the request is genuinely simple, say so and keep it short rather than inflating it.

The request:

[paste it verbatim]`,
  },

  {
    id: "explain-codebase",
    title: "Understand an unfamiliar codebase",
    blurb:
      "A map you can act on — where things live, what the conventions are, and where the traps are.",
    category: "Plan",
    tags: ["onboarding", "codebase", "architecture", "explain", "map"],
    howToUse:
      "Run this in a repository your assistant can read. Add the one task you are actually here to do — it changes what matters.",
    body: `I am new to this codebase and I need to be productive in it today, not to understand all of it.

Read the code — not just the README, which is usually out of date — and give me:

**1. What this is,** in three sentences. What it does, who uses it, and what it talks to.

**2. The shape.** The five to eight directories that matter, what each holds, and how a request or an action flows through them from entry point to storage and back. Name real files.

**3. The conventions this codebase actually follows,** as opposed to the ones its config file claims. How state is managed, how errors are handled, how things are named, how modules talk to each other, where types live, what the test style is. Cite one real example of each so I can copy the pattern rather than invent one.

**4. Where the truth lives.** For each of the main concepts in the domain, the one file that defines it. When I need to change what a thing *is*, this is the list I want.

**5. The traps.** Things that will bite someone new: a module that looks generic and is not, two things with similar names that are unrelated, a file that is generated and will be overwritten, a test that is slow or flaky, a directory that is dead code, a place where the obvious change breaks something far away. This section is worth more than the rest; spend effort on it.

**6. How to run it.** Install, run, test, and the one command that tells me whether I have broken anything.

**7. For the task below specifically:** the files I will need to touch, in the order I should read them, and the one thing about this codebase that will surprise me while doing it.

Cite a file path for every claim. If you are inferring rather than reading, say so. I would rather have a short honest map than a long confident one.

My task:

[what you are here to do]`,
  },

  {
    id: "tests-that-matter",
    title: "Write tests worth having",
    blurb:
      "Tests for the behaviour that can actually break, instead of one assertion per function.",
    category: "Build",
    tags: ["testing", "tests", "coverage", "quality", "edge cases"],
    howToUse:
      "Paste the code or point at the module. Mention your test runner if it is not obvious from the repository.",
    body: `Write tests for the code below. Read it first and decide what is worth testing before you write a single test.

What to test, in priority order:

1. **The behaviour a user or caller depends on** — the contract, not the implementation. A test that would still pass after a legitimate refactor is a good test; one that breaks when you rename a private function is a liability.
2. **The cases where it goes wrong.** Empty input, one item, the boundary, the maximum, the wrong type, the null in the middle, the second call, the concurrent call, the one that fails halfway.
3. **The bug this code was written to fix**, if you can tell what it was. That test is the one that stops it coming back.
4. **The invariant.** If something must always be true — a total always matching its parts, an ordering preserved, a round trip returning the original — assert that directly rather than testing examples of it.

What not to write:

- A test per function, mechanically. Coverage is not the goal; catching regressions is.
- Tests that assert the mock was called. That tests the test.
- A test whose setup is longer than the code under test, when a simpler one would fail on the same bug.
- Snapshot tests of anything a person would not read.

For each test, the name says what breaks if it fails — "returns the original after a round trip", not "test parse works". Someone reading only the names should learn what the module guarantees.

At the end, tell me:

- **What you deliberately did not test, and why.** This matters as much as what you did.
- **The one case you are least sure about** — where you had to guess the intended behaviour rather than read it.

Here is the code:

[paste the module, or name the file]`,
  },

  {
    id: "refactor-safely",
    title: "Refactor without breaking anything",
    blurb:
      "A sequenced plan where every step leaves the code working and reviewable on its own.",
    category: "Build",
    tags: ["refactor", "migration", "cleanup", "incremental", "safety"],
    howToUse:
      "Say what shape you want it in. If you are not sure, describe what is painful about it now and let the plan propose the shape.",
    body: `I want to restructure the code below. Give me a plan where the code works at every step, not a rewrite.

First, before planning:

- **Say what the current code actually guarantees**, including anything accidental that callers may now depend on. This is the part people skip and then break.
- **Find every caller.** List them. A refactor plan that misses a caller is not a plan.
- **Say what is covered by tests and what is not.** Anything not covered has to be characterised before it moves — write a test that pins the current behaviour, even the behaviour you think is wrong. You are preserving it, not endorsing it.

Then give me the sequence. Every step must:

- leave the code compiling and the tests passing;
- be reviewable on its own, in under an hour;
- state what it changes and what it deliberately leaves alone;
- name how you would know it went wrong.

Prefer this shape: add the new thing beside the old one, move callers across in small groups, then delete the old one in a final step that touches nothing else. Never a step that changes structure and behaviour at once — if a step does both, split it.

Finally:

- **The point of no return.** Which step is the one after which going back is expensive, so I can decide before it rather than during it.
- **What I should not refactor**, and why. There is usually something ugly that is ugly for a reason.

Here is the code, and the shape I want it in:

[paste the code; describe the target shape or the pain]`,
  },

  {
    id: "decide-between",
    title: "Choose between two approaches",
    blurb:
      "A recommendation with a reason, not a table of pros and cons that leaves the decision with you.",
    category: "Plan",
    tags: ["decision", "architecture", "trade-off", "compare", "options"],
    howToUse:
      "Describe both options and, importantly, your constraints — team size, deadline, what you already run. Those decide it more often than the technology does.",
    body: `Help me decide between the options below. I want a recommendation, not a comparison table.

Give me:

**1. The real difference.** Most comparisons list twenty differences of which two matter. Name the two or three that would actually change the outcome for my situation, and ignore the rest.

**2. What each option is betting on.** Every choice assumes something about the future — that this will grow, that it will not, that the team will stay this size, that this dependency will still be maintained. Name the bet each option is making. That is usually the whole decision.

**3. The cost of being wrong, in each direction.** Not the probability — the cost. An option that is cheap to reverse deserves less deliberation than one that is not, even if it is slightly worse on paper.

**4. Your recommendation**, in one paragraph, with the reason. Commit to one. If the honest answer is that it does not matter, say that — it is a real finding and it saves me a week.

**5. What would change your mind.** The specific fact about my situation that would flip the recommendation, so I can go and check it.

Do not hedge, do not give me a table, and do not tell me it depends without saying what it depends on and which side of that I am on.

The options:

[describe them]

My constraints:

[team size, timeline, what you already run, what you cannot change]`,
  },
]
