import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"
import { isEmpty } from "lodash"

import { playerIsOnTeam } from '@/player'
import { getFile } from '@/getFile'
import { addLabels } from '@/issues'
import { analyseMove } from '@/analyseMove'
import { generateReadme } from '@/generateReadme'
import { Change } from '@/play'
import { Log } from '@/log'

export async function makeMove (
  move: string,
  gamePath: string,
  octokit: Octokit,
  context: Context,
  log: Log,
): Promise<Change[]> {
  /**
   * Called when a player uses the "move" command.
   *
   * @param state: The current state of the game.
   * @param move: The move the player wants to make.
   * @param gamePath: The location of the current game's state file.
   * @returns An array of changes to add to the commit.
   */
  let changes: Change[] = []
  // Get the current game state file, but it's null if the file doesn't exist
  const stateFile = await getFile(
    "play", gamePath, "state.json", octokit, context
  )
  if (!stateFile) {
    throw new Error('MOVE_WHEN_EMPTY_GAME')
  }
  if (Array.isArray(stateFile.data)) {
    throw new Error('FILE_IS_DIR')
  }

  const state = JSON.parse(
    Buffer.from(stateFile.data.content!, "base64").toString()
  )

  if (!state.currentPlayer) {
    throw new Error('MOVE_WHEN_GAME_ENDED')
  }
  // First I need to validate which team the user is on
  if (!playerIsOnTeam(context.actor, state.currentPlayer)) {
    throw new Error('WRONG_TEAM')
  }
  if (state.currentPlayer === Ur.BLACK) {
    addLabels(["Black team"], octokit, context)
  } else {
    addLabels(["White team"], octokit, context)
  }
  // The move should be 'a@b' where a is the dice count and b is the position
  // The given diceResult must match the internal diceResult
  const [diceResult, fromPosition] = move.split('@').map(a => parseInt(a))
  if (diceResult === undefined || diceResult !== state.diceResult) {
    throw new Error('WRONG_DICE_COUNT')
  }
  if (fromPosition === undefined) {
    throw new Error('NO_MOVE_POSITION')
  }
  // The fromPosition must be a key of one of the possibleMoves
  // However, there may be no possible moves, in which case possibleMoves will
  // be an empty object, in which case any move is "allowed"
  if(!(`${fromPosition}` in state.possibleMoves!)
     && !isEmpty(state.possibleMoves!)) {
    throw new Error('IMPOSSIBLE_MOVE')
  }
  const toPosition = state.possibleMoves![`${fromPosition}`]
  // Everything seems ok, so execute the move
  const newState = Ur.takeTurn(state, state.currentPlayer, fromPosition)

  // Replace the contents of the current game state file with the new state
  changes.push({
    path: `${gamePath}/state.json`,
    content: JSON.stringify(newState),
  })

  // Move has been performed and the result has been saved.
  // All that remains is to report back to the issue and update the README.

  // Let's detect what happened in that move
  const events = analyseMove(state, fromPosition, toPosition)
  if (events.rosetteClaimed) {
    addLabels([":rosette: Rosette!"], octokit, context)
  }
  if (events.captureHappened) {
    addLabels([":crossed_swords: Capture!"], octokit, context)
  }
  if (events.ascensionHappened) {
    addLabels([":rocket: Ascension!"], octokit, context)
  }
  if (events.gameWon) {
    addLabels([":crown: Winner!"], octokit, context)
  }

  // Add a comment to the issue to indicate that the move was successful
  octokit.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: `@${context.actor} Done! You ${events.ascensionHappened ? "ascended" : "moved"} a ${state.currentPlayer === Ur.BLACK ? "black" : "white"} piece ${fromPosition === 0 ? "onto the board" : `from position ${fromPosition}`}${events.ascensionHappened ? ". " : ` to position ${toPosition}${events.captureHappened ? ", capturing the opponents' piece!" : ""}. `}${events.rosetteClaimed ? "You claimed a rosette, meaning that your team gets to take another turn! " : ""}${events.gameWon ? "This was the winning move! " : ""}\n\nAsk a friend to make the next move: [share on Twitter](https://twitter.com/share?text=I'm+playing+The+Royal+Game+of+Ur+on+a+GitHub+profile.+I+just+moved+%E2%80%94+take+your+turn+at+https://github.com/rossjrw+%23ur+%23github)`
  })
  octokit.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    state: "closed",
  })

  // If the game was won, leave a message to let everyone know
  if (events.gameWon) {
    // TODO - need to find a reliable way of working out which issues are
    // related to this one (that's not based on issue titles)
    octokit.issues.createComment({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: context.issue.number,
      body: "The game has been won!",
    })
  }

  // Update README.md with the new state
  changes = changes.concat(
    await generateReadme(newState, gamePath, octokit, context, log)
  )

  // Update the log with this action
  log.addToLog(
    "move",
    `${events.ascensionHappened ? "ascended" : "moved"} a ${state.currentPlayer === Ur.BLACK ? "black" : "white"} piece ${fromPosition === 0 ? "onto the board" : `from position ${fromPosition}`} ${events.ascensionHappened ? ":rocket:" : `to position ${toPosition}${events.captureHappened ? ` — captured a ${state.currentPlayer === Ur.BLACK ? "white" : "black"} piece :crossed_swords:` : ""}. `}${events.rosetteClaimed ? " — claimed a rosette :rosette:" : ""}${events.gameWon ? " — won the game :crown:" : ""}`,
    state.currentPlayer,
  )

  return changes
}
