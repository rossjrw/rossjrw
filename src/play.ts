import { Octokit } from "@octokit/rest/index"
import { Context } from "@actions/github/lib/context"
import { default as _core } from "@actions/core"
import { compress } from "compress-tag"
import Ur from "ur-game"

import { addReaction } from "@/issues"
import { handleError } from "@/error"
import { resetGame } from "@/new"
import { makeMove, Move } from "@/move"
import { makeCommit } from "@/commit"
import { Log } from "@/log"
import { getFile } from "@/getFile"
import { teamName } from "@/teams"
import { generateReadme } from "@/generateReadme"

export interface Change {
  path: string
  content: string | null
}

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
export default async function play(
  title: string,
  octokit: Octokit,
  context: Context,
  core: typeof _core
): Promise<void> {
  // The Octokit client comes pre-authenticated, so there's no need to
  // instantiate it.

  const gamePath = "games/current"
  const oldGamePath = "games"

  // Prepare a list of changes, which will be made into a single commit to the
  // play branch
  let changes: Change[] = []

  // Prepare a log object, which will be used to merge log entries into a
  // single change
  const log = new Log(gamePath, octokit, context)
  await log.prepareInitialLog()

  try {
    // Immediately add the eyes reaction to indicate acknowledgement
    addReaction("eyes", octokit, context)

    // Get the current game state file, but it's null if the file doesn't exist
    const stateFile = await getFile(
      "play",
      gamePath,
      "state.json",
      octokit,
      context
    )
    if (!stateFile) {
      throw new Error("MOVE_WHEN_EMPTY_GAME")
    }
    if (Array.isArray(stateFile.data)) {
      throw new Error("FILE_IS_DIR")
    }
    let state = <Ur.State>(
      JSON.parse(Buffer.from(stateFile.data.content!, "base64").toString())
    )

    const action = parseIssueTitle(title)

    if (action.command === "new") {
      changes = changes.concat(
        await resetGame(gamePath, oldGamePath, octokit, context, log)
      )
    } else if (action.command === "move") {
      state = await makeMove(
        state,
        action.move,
        gamePath,
        octokit,
        context,
        log
      )
      // Update README.md with the new state
      changes = changes.concat(
        await generateReadme(state, gamePath, octokit, context, log)
      )
      // Replace the contents of the current game state file with the new state
      changes.push({
        path: `${gamePath}/state.json`,
        content: JSON.stringify(state, null, 2),
      })
    }

    // Extract changes from the log
    changes = changes.concat(log.makeLogChanges())

    // All the changes have been collected - commit them
    await makeCommit(
      `@${context.actor} ${
        action.command === "new"
          ? "Start a new game"
          : compress`
              Move ${teamName(state.currentPlayer)}
              ${action.move.distance}@${action.move.fromPosition}
            `
      } (#${context.issue.number})`,
      changes,
      octokit,
      context
    )

    addReaction("rocket", octokit, context)
  } catch (error: any) {
    // If there was an error, forward it to the user, then stop
    handleError(error, log, octokit, context, core)
    return
  }
}

/**
 * Parses the issue title into move instructions.
 *
 * @param title - The title of the issue.
 * @return A tuple of the name of the action to take, and if the action is
 * move, details of the requested move.
 */
function parseIssueTitle(
  title: string
): { command: "new" } | { command: "move"; move: Move } {
  const [gamename, command, moveInstruction, gameId] = title.split("-")
  if (!gamename || gamename !== "ur") {
    throw new Error("WRONG_GAME")
  }
  if (command === "new") {
    return { command }
  } else if (command === "move") {
    if (!moveInstruction) {
      throw new Error("NO_MOVE_GIVEN")
    }
    if (!gameId) {
      throw new Error("NO_ID_GIVEN")
    }
    if (!/\d+@\d+/.test(moveInstruction)) {
      throw new Error("MOVE_BAD_FORMAT")
    }
    if (isNaN(parseInt(gameId))) {
      throw new Error("NON_NUMERIC_ID")
      // The game ID would be used to select the ID of the game the move is
      // intended for, and would be useful for introspecting action
      // histories across multiple games. But because an issue only ever
      // applies to the current game at the time of the issue's creation,
      // it is not needed here and thus not returned.
    }
    // The move should be 'a@b' where a is the dice count and b is the position
    // The given diceResult must match the internal diceResult
    const [distance, fromPosition] = moveInstruction
      .split("@")
      .map((v) => parseInt(v))
    if (isNaN(distance) || distance === undefined) {
      throw new Error("WRONG_DICE_COUNT")
    }
    if (isNaN(distance) || fromPosition === undefined) {
      throw new Error("NO_MOVE_POSITION")
    }
    const move = { distance, fromPosition }
    return { command, move }
  } else {
    throw new Error("UNKNOWN_COMMAND")
  }
}
