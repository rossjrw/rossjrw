import { Octokit } from "@octokit/rest/index"
import Ur from "ur-game"

import { Context } from "@/gh"
import { Log } from "@/log"
import { passUnplayableTurns } from "@/passUnplayableTurns"

const context = {
  actor: "player",
  repo: { owner: "owner", repo: "repo" },
  issue: { owner: "owner", repo: "repo", number: 1 },
} as Context

// ur-game rolls each die with Math.round(Math.random()), so 0 rolls a 0 on
// that die and 0.9 rolls a 1
function rollDice(...rolls: number[]): void {
  const random = jest.spyOn(Math, "random")
  rolls.forEach((roll) => {
    for (let die = 0; die < 4; die++) {
      random.mockReturnValueOnce(die < roll ? 0.9 : 0)
    }
  })
}

let log: Log

beforeEach(() => {
  log = new Log("games/current", {} as Octokit, context)
})

afterEach(() => {
  jest.restoreAllMocks()
})

test("does not pass a turn that has a move to make", () => {
  rollDice(2)
  const state = Ur.startGame(7, 4, Ur.WHITE)

  expect(passUnplayableTurns(state, log)).toBe(state)
  expect(log.internalLog).toEqual([])
})

test("passes an opening roll of 0", () => {
  rollDice(0, 3)
  const state = Ur.startGame(7, 4, Ur.WHITE)

  const playableState = passUnplayableTurns(state, log)

  expect(playableState.currentPlayer).toBe(Ur.BLACK)
  expect(playableState.diceResult).toBe(3)
  expect(log.internalLog).toMatchObject([
    { action: "pass", team: Ur.WHITE, roll: 0, issue: 1 },
  ])
})

test("passes turns until a team has a move to make", () => {
  rollDice(0, 0, 1)
  const state = Ur.startGame(7, 4, Ur.WHITE)

  const playableState = passUnplayableTurns(state, log)

  expect(playableState.currentPlayer).toBe(Ur.WHITE)
  expect(playableState.diceResult).toBe(1)
  expect(log.internalLog).toMatchObject([
    { action: "pass", team: Ur.WHITE, roll: 0 },
    { action: "pass", team: Ur.BLACK, roll: 0 },
  ])
})

test("does not pass a turn after the game has ended", () => {
  const state: Ur.State = {
    winner: Ur.WHITE,
    board: Ur.startGame(7, 4, Ur.WHITE).board,
  }

  expect(passUnplayableTurns(state, log)).toBe(state)
  expect(log.internalLog).toEqual([])
})
