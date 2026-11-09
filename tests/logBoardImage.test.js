const fs = require("fs")
const path = require("path")
const ts = require("typescript")

function newLog(issues) {
  const file = path.resolve(__dirname, "../src/log.ts")
  const js = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText
  const module = { exports: {} }
  new Function("module", "exports", "require", js)(
    module, module.exports, () => { throw new Error("Unexpected runtime import") },
  )
  const log = new module.exports.Log(
    "games/current",
    {},
    { actor: "test-user", repo: { owner: "owner", repo: "repo" }, issue: { number: 4934 } },
  )
  log.internalLog = issues.map((issue) => ({ issue, boardImage: null }))
  log.lastCommitSha = "prior-commit"
  return log
}

test("links the last previously committed board after multiple passes", () => {
  const log = newLog([4933, 4934, 4934])
  log.linkPreviousBoardState()

  expect(log.internalLog[0].boardImage).toBe(
    "https://raw.githubusercontent.com/owner/repo/prior-commit/games/current/board.4933.svg",
  )
  expect(log.internalLog[1].boardImage).toBeNull()
  expect(log.internalLog[2].boardImage).toBeNull()
})

test("does not link an intermediate board from opening auto-passes", () => {
  const log = newLog([4933, 4933, 4933])
  log.linkPreviousBoardState()

  expect(log.internalLog.every((entry) => entry.boardImage === null)).toBe(true)
})

test("preserves the expected link for a single subsequent turn", () => {
  const log = newLog([4933, 4934])
  log.linkPreviousBoardState()

  expect(log.internalLog[0].boardImage).toContain("board.4933.svg")
  expect(log.internalLog[1].boardImage).toBeNull()
})
