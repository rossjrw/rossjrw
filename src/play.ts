import { Octokit } from "@octokit/rest/index"
import { default as _core } from "@actions/core"
import { Buffer } from "buffer"
import Ur from "ur-game"

import { makeCommit } from "@/commit"
import { handleError } from "@/error"
import { generateReadme } from "@/generateReadme"
import { getFile } from "@/getFile"
import { Context, isIssueContext } from "@/gh"
import { addReaction } from "@/issues"
import { Log } from "@/log"
import { makeMove } from "@/move"
import { announceNewGame, resetGame } from "@/new"
import { passUnplayableTurns } from "@/passUnplayableTurns"
import { teamName } from "@/teams"

export interface Change {
  path: string
  content: string | null
}

export default async function play(
  title: string,
  octokit: Octokit,
  context: Context,
  core: typeof _core,
): Promise<void> {
  /**
   * Let's play Ur!
   *
   * This project is inspired by timburgan/timburgan - thank you Tim!
   *
   * Recieves parameters from actions/github-script:
   * @param title: The title of the triggering issue.
   * @param octokit: octokit/rest.js client.
   * @param context: Workflow context object.
   * @returns void: At least until I work out what this should do!
   */
  // The Octokit client comes pre-authenticated, so there's no need to
  // instantiate it.

  const gamePath = "games/current"
  const oldGamePath = "games"
  const log = new Log(gamePath, octokit, context)
  await log.prepareInitialLog()

  try {
    if (isIssueContext(context)) {
      addReaction("eyes", octokit, context)
    }

    const [command, move] = parseIssueTitle(title)

    // Get the current game state file, but it's null if the file doesn't exist
    const stateFile = await getFile(
      "play",
      gamePath,
      "state.json",
      octokit,
      context,
    )
    if (!stateFile) {
      throw new Error("MOVE_WHEN_EMPTY_GAME")
    }
    if (Array.isArray(stateFile.data)) {
      throw new Error("FILE_IS_DIR")
    }
    const state: Ur.State = JSON.parse(
      Buffer.from(stateFile.data.content!, "base64").toString(),
    )

    let changes: Change[] = []
    let nextState: Ur.State
    let commitMessage: string

    // Work out the next state of the game for each command
    if (command === "new") {
      const [newState, archiveChanges] = resetGame(
        oldGamePath,
        context.actor,
        log,
      )
      nextState = newState
      changes = changes.concat(archiveChanges)
      commitMessage = `(${context.actor}) Start a new game (#${context.issue?.number})`
    } else if (command === "move") {
      nextState = await makeMove(state, move, octokit, context, log)
      commitMessage = `(${context.actor}) Move ${teamName(
        state.currentPlayer,
      )} ${move} (#${context.issue?.number})`
    } else if (command === "refresh") {
      nextState = state
      commitMessage = `(${context.actor}) Regenerate README after update`
    } else {
      throw command satisfies never
    }

    // If the team to play has no possible moves (e.g. it rolled a 0), nobody
    // can make the move that the game would wait for, so pass the turn now
    const playableState = passUnplayableTurns(nextState, log)

    if (command === "new" && isIssueContext(context)) {
      announceNewGame(playableState, octokit, context)
    }

    changes = changes.concat(
      await generateReadme(playableState, gamePath, octokit, context, log),
      {
        path: `${gamePath}/state.json`,
        content: JSON.stringify(playableState, null, 2),
      },
      // Generating the README links the previous board image into the log, so
      // the log must be saved after it
      log.makeLogChanges(),
    )

    // All the changes have been collected - commit them
    await makeCommit(commitMessage, changes, octokit, context)

    if (isIssueContext(context)) {
      addReaction("rocket", octokit, context)
    }
  } catch (error) {
    // If there was an error, forward it to the user, then stop
    if (error instanceof Error)
      handleError(error, log, octokit, context, core)
    return
  }
}

function parseIssueTitle(
  title: string,
): ["new" | "move" | "refresh", string] {
  /**
   * Parses the issue title into move instructions.
   *
   * @param title: The title of the issue.
   */
  const [gamename, command, move, gameId] = title.split("-")
  if (!gamename || gamename !== "ur") {
    throw new Error("WRONG_GAME")
  }
  if (!command || !["new", "move", "refresh"].includes(command)) {
    throw new Error("UNKNOWN_COMMAND")
  }
  if (command === "move") {
    if (!move) {
      throw new Error("NO_MOVE_GIVEN")
    }
    if (!gameId) {
      throw new Error("NO_ID_GIVEN")
    }
    if (!/\d+@\d+/.test(move)) {
      throw new Error("MOVE_BAD_FORMAT")
    }
    if (isNaN(parseInt(gameId))) {
      throw new Error("NON_NUMERIC_ID")
    }
    return [command, move]
  }
  return [command as "new" | "refresh", ""]
}
