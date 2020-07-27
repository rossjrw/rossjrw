import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import { default as _core } from "@actions/core"
import { get } from "lodash"

import { addReaction, addLabels } from '@/issues'
import { getPlayerTeam } from '@/player'

interface ErrorDescriptions {
  [error_type: string]: string
}

export function handleError(
  error: Error,
  octokit: Octokit,
  context: Context,
  core: typeof _core,
): void {
  /**
   * Handles execution errors by reporting the problem back to the user and
   * closing the issue.
   *
   * @param error: The error to report with an ID matching the desc object.
   */
  const ERROR_DESC: ErrorDescriptions = {
    // Action parsing
    WRONG_GAME: "Sorry, I only know how to play Ur.",
    UNKNOWN_COMMAND: "I'm not sure what you're asking me to do — the only commands I know are 'new' and 'move'.",
    NO_MOVE_GIVEN: "You've asked me to make a move, but you haven't told me which move to make.",
    NO_ID_GIVEN: "You've told me what move to make, but I'm not sure where I should make it without a game ID.",
    MOVE_BAD_FORMAT: "You've asked me to make a move, but I'm not sure what exactly you want me to do. Is your move in the right format?",
    NON_NUMERIC_ID: "You've told me what move to make, but the game ID you've given me isn't a number.",
    // Execution errors
    MOVE_WHEN_GAME_ENDED: "You can't make a move when the game has finished! You'll have to start a new game instead.",
    WRONG_TEAM: `Sorry, you're on the ${getPlayerTeam(context.actor) === "b" ? "black" : "white"} team — you can't make moves for the ${getPlayerTeam(context.actor) === "b" ? "white" : "black"} team!`,
    WRONG_DICE_COUNT: "You tried to move a piece by the wrong number of places. Check the dice roll!",
    NO_MOVE_POSITION: "I can't tell which piece you want to move.",
    IMPOSSIBLE_MOVE: "Woah, that's not a legal move! Maybe someone snuck in a move before yours.",
  }
  const ERROR_DEFAULT = "Something went wrong, but I'm not sure exactly what.\n\n@rossjrw "

  addReaction("confused", octokit, context)
  octokit.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: `@${context.actor} ${get(ERROR_DESC, error.message, ERROR_DEFAULT + error.message)}`,
  })
  addLabels(["Unsuccessful"], octokit, context)
  octokit.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    state: "closed",
  })

  core.error(error)

  // Seems like this is the only reliable way for me to know what actually
  // caused the error
  throw error
}
