import { Octokit } from "@octokit/rest/index"
import Ur from "ur-game"

import { Context } from "@/gh"
import { Log } from "@/log"

const context = {
  actor: "player",
  repo: { owner: "owner", repo: "repo" },
  issue: { owner: "owner", repo: "repo", number: 1 },
} as Context

function boardImage(issue: number): string {
  return `https://raw.githubusercontent.com/owner/repo/abc123/games/current/board.${issue}.svg`
}

let log: Log

beforeEach(() => {
  log = new Log("games/current", {} as Octokit, context)
  log.lastCommitSha = "abc123"
})

// Adds an action to the log as though it was made by the given issue
function addAction(issue: number, action: "new" | "move" | "pass"): void {
  log.issue = issue
  log.addToLog(action, Ur.WHITE, null, null, null, null)
}

describe("linkPreviousBoardState", () => {
  test("links the board of the previous issue", () => {
    addAction(1, "new")
    addAction(2, "move")

    log.linkPreviousBoardState()

    expect(log.internalLog.map((logItem) => logItem.boardImage)).toEqual([
      boardImage(1),
      null,
    ])
  })

  test("links the previous issue when this issue passed a turn", () => {
    addAction(1, "new")
    addAction(2, "move")
    addAction(2, "pass")

    log.linkPreviousBoardState()

    expect(log.internalLog.map((logItem) => logItem.boardImage)).toEqual([
      boardImage(1),
      null,
      null,
    ])
  })

  test("links the last action of a previous issue that passed a turn", () => {
    addAction(1, "new")
    addAction(2, "move")
    addAction(2, "pass")
    log.linkPreviousBoardState()
    addAction(3, "move")

    log.linkPreviousBoardState()

    expect(log.internalLog.map((logItem) => logItem.boardImage)).toEqual([
      boardImage(1),
      null,
      boardImage(2),
      null,
    ])
  })

  test("links nothing when no earlier issue has played", () => {
    addAction(1, "new")
    addAction(1, "pass")

    log.linkPreviousBoardState()

    expect(log.internalLog.map((logItem) => logItem.boardImage)).toEqual([
      null,
      null,
    ])
  })
})
