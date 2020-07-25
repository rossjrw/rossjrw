import { Octokit } from "@octokit/rest"
import { Context } from "@actions/github/lib/context"
import Ur from "ur-game"
import { isEmpty } from "lodash"

import { getPlayerTeam } from '@/player'
import { addLabels } from '@/issues'
import { updateSvg } from '@/updateSvg'
import { analyseMove } from '@/analyseMove'
import { generateReadme } from './generateReadme'

export async function resetGame (
  gamePath: string,
  octokit: Octokit,
  context: Context,
): Promise<void> {
  /**
   * Called when a player uses the "new" command.
   *
   * I don't want this to happen willy-nilly, so I might add some restriction
   * here - maybe no moves for a few hours or something.
   */
  // Delete the current game state
  const stateFile = await octokit.repos.getContents({
    owner: context.issue.owner,
    repo: context.issue.repo,
    path: `${gamePath}/state.json`,
  })
  if (Array.isArray(stateFile.data)) {
    throw new Error('FILE_IS_DIR')
  }
  await octokit.repos.deleteFile({
    owner: context.issue.owner,
    repo: context.issue.repo,
    path: `${gamePath}/state.json`,
    branch: 'play',
    message: `Delete the old game (#${context.issue.number})`,
    sha: stateFile.data.sha!,
  })

  // Make a new game state
  const newState = Ur.startGame(7, 4, getPlayerTeam(context.actor))

  // Save the new state
  await octokit.repos.createOrUpdateFile({
    owner: context.repo.owner,
    repo: context.repo.repo,
    branch: "play",
    path: `${gamePath}/state.json`,
    message: `@${context.actor} Start a new game (#${context.issue.number})`,
    content: Buffer.from(JSON.stringify(newState)).toString("base64"),
    sha: stateFile.data.sha,
  })

  // Add a comment to the issue to indicate that a new board was made
  octokit.issues.createComment({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    body: `@${context.actor} Done! You started a new game.\n\nMake the next move yourself, or ask a friend: [share on Twitter](https://twitter.com/share?text=I'm+playing+The+Royal+Game+of+Ur+on+a+GitHub+profile.+A+new+game+just+started+%E2%80%94+take+your+turn+at+https://github.com/rossjrw+%23ur+%23github`
  })
  octokit.issues.update({
    owner: context.repo.owner,
    repo: context.repo.repo,
    issue_number: context.issue.number,
    state: "closed",
  })
}

export async function makeMove (
  state: Ur.State,
  move: string,
  gamePath: string,
  octokit: Octokit,
  context: Context,
): Promise<void> {
  /**
   * Called when a player uses the "move" command.
   *
   * @param state: The current state of the game.
   * @param move: The move the player wants to make.
   * @param gamePath: The location of the current game's state file.
   */
  if (!state.currentPlayer) {
    throw new Error('GAME_ENDED')
  }
  // First I need to validate which team the user is on
  if (state.currentPlayer !== getPlayerTeam(context.actor)) {
    throw new Error('WRONG_TEAM')
  }
  if (getPlayerTeam(context.actor) === Ur.BLACK) {
    addLabels(["Black team"], octokit, context)
  } else {
    addLabels(["White team"], octokit, context)
  }
  // The move should be 'a@b' where a is the dice count and b is the position
  // The given diceResult must match the internal diceResult
  const [diceResult, fromPosition] = move.split('@').map(a => parseInt(a))
  if (!diceResult || diceResult !== state.diceResult) {
    throw new Error('WRONG_DICE_COUNT')
  }
  if (!fromPosition) {
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

  // Next job is to save the new state
  // Replace the contents of the current game state file with the new state
  const stateFile = await octokit.repos.getContents({
    owner: context.issue.owner,
    repo: context.issue.repo,
    ref: "play",
    path: `${gamePath}/state.json`,
    mediaType: { format: "raw" },
  })
  if (Array.isArray(stateFile.data)) {
    throw new Error('FILE_IS_DIR')
  }

  await octokit.repos.createOrUpdateFile({
    owner: context.repo.owner,
    repo: context.repo.repo,
    branch: "play",
    path: `${gamePath}/state.json`,
    message: `@${context.actor} Move ${newState.currentPlayer === "b"? "black" : "white"} from ${fromPosition} to ${toPosition} (#${context.issue.number})`,
    content: Buffer.from(JSON.stringify(newState)).toString("base64"),
    sha: stateFile.data.sha,
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
    body: `@${context.actor} Done! You ${events.ascensionHappened ? "ascended" : "moved"} a ${state.currentPlayer === Ur.BLACK ? "black" : "white"} piece ${fromPosition === 0 ? "onto the board" : `from position ${fromPosition}`}${events.ascensionHappened ? ". " : ` to position ${toPosition}. `}${events.rosetteClaimed ? "You claimed a rosette, meaning that your team gets to take another turn! " : ""}${events.gameWon ? "This was the winning move! " : ""}\n\nAsk a friend to make the next move: [share on Twitter](https://twitter.com/share?text=I'm+playing+The+Royal+Game+of+Ur+on+a+GitHub+profile.+I+just+moved+%E2%80%94+take+your+turn+at+https://github.com/rossjrw+%23ur+%23github`
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

  // Update the SVG to represent the new game board
  const boardImageHash = await updateSvg(
    state,
    gamePath,
    "assets/board.optimised.svg", // TODO change for compiled branch
    octokit,
    context
  )

  // Update README.md with the new state
  await generateReadme(state, boardImageHash, octokit, context)
}
