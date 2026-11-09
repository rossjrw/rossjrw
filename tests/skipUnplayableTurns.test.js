const fs = require("fs")
const path = require("path")
const ts = require("typescript")

// The repo uses Jest without a TypeScript transformer. Transpile this
// isolated helper and mock only the ur-game turn transition.
function loadHelper(voidTurn) {
  const file = path.resolve(__dirname, "../src/skipUnplayableTurns.ts")
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      esModuleInterop: true,
    },
  }).outputText
  const module = { exports: {} }
  const mockRequire = (id) => {
    if (id === "ur-game") return { voidTurn }
    throw new Error(`Unexpected import: ${id}`)
  }
  new Function("require", "module", "exports", code)(
    mockRequire, module, module.exports,
  )
  return module.exports.skipUnplayableTurns
}

function fakeLog() {
  const entries = []
  return {
    entries,
    addToLog: (...args) => entries.push(args),
  }
}

test("keeps an already-playable starting roll unchanged", () => {
  const skip = loadHelper(() => { throw new Error("Unexpected pass") })
  const log = fakeLog()
  const state = { currentPlayer: "b", diceResult: 2, possibleMoves: { 0: 2 } }
  expect(skip(state, log)).toBe(state)
  expect(log.entries).toHaveLength(0)
})

test("passes a zero opening roll and returns a playable opponent turn", () => {
  const next = { currentPlayer: "w", diceResult: 3, possibleMoves: { 0: 3 } }
  const skip = loadHelper(() => next)
  const log = fakeLog()
  const result = skip({ currentPlayer: "b", diceResult: 0, possibleMoves: {} }, log)
  expect(result).toBe(next)
  expect(log.entries).toEqual([["pass", "b", 0, null, null, null]])
})

test("handles successive unplayable rolls for alternating teams", () => {
  const turns = [
    { currentPlayer: "w", diceResult: 0, possibleMoves: {} },
    { currentPlayer: "b", diceResult: 1, possibleMoves: { 0: 1 } },
  ]
  const skip = loadHelper(() => turns.shift())
  const log = fakeLog()
  const result = skip({ currentPlayer: "b", diceResult: 0, possibleMoves: {} }, log)
  expect(result).toEqual({ currentPlayer: "b", diceResult: 1, possibleMoves: { 0: 1 } })
  expect(log.entries.map((x) => x[1])).toEqual(["b", "w"])
})

test("fails fast if the library cannot pass a turn", () => {
  const skip = loadHelper(() => false)
  const log = fakeLog()
  expect(() => skip({ currentPlayer: "w", diceResult: 0, possibleMoves: {} }, log))
    .toThrow("Unable to pass an unplayable turn")
})

test("bounds attempts when the dice are permanently unplayable", () => {
  const skip = loadHelper((state) => ({
    currentPlayer: state.currentPlayer === "w" ? "b" : "w",
    diceResult: 0,
    possibleMoves: {},
  }))
  const log = fakeLog()
  expect(() => skip({ currentPlayer: "b", diceResult: 0, possibleMoves: {} }, log))
    .toThrow("Unable to generate a playable turn after 64 passes")
  expect(log.entries).toHaveLength(64)
})
